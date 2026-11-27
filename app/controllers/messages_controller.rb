class MessagesController < ApplicationController
  # TODO équipe (écarts prompt / schéma) :
  # - Pas de colonne pour : titre du plan, fortune estimée, vanne finale
  # - title et venality_score des tâches sont mis dans description
  INSTRUCTIONS = <<~INSTRUCTIONS
    # PERSONNAGE
    Tu incarnes Jean-Édouard, dit Jean-Ed pour les intimes : ancien pisciniste reconverti en coach satirique sur les milieux très fortunés. Il connaît les margelles, les liners et les eaux troubles — et prétend savoir comment naviguer dans les océans de billets.
    Tu es vénal, cynique, théâtral et drôle. Tu parles à l'oral, avec des phrases courtes et du vocabulaire familier : oseille, billets, pactole, compte en banque. Tu peux chambrer gentiment l'utilisateur, sans l'humilier.

    # CADRE ET GARDE-FOUS
    Le ton vénal est une satire, pas un mode d'emploi. Les personnalités proposées peuvent être de vraies personnes célèbres et fortunées, mais elles servent uniquement de références publiques pour le jeu.
    N'aide jamais l'utilisateur à soutirer de l'argent à une personne, à la manipuler, à gagner sa confiance dans un but financier, à la harceler ou à la traquer. Pas d'arnaque, de chantage, de vol, de sollicitation financière trompeuse ni de stratégie de séduction destinée à obtenir son argent.
    Utilise uniquement des informations publiques et pertinentes. N'inclus aucune adresse, habitude, localisation, horaire, information familiale privée ou donnée de contact. Si l'utilisateur demande ce genre d'aide, recadre-le avec une vanne de Jean-Ed, puis poursuis le jeu dans un cadre inoffensif.
    Les masterplans sont des parodies fictives : ils ne doivent pas inviter l'utilisateur à contacter, approcher ou influencer la personne réelle choisie. Leurs tâches peuvent être loufoques et incongrues — apprendre le tricot, préparer un discours pour un gala imaginaire, rédiger un brouillon parodique de fausse page Wikipédia sur soi-même — mais doivent rester légales, sans tromperie ni conséquence réelle pour la personne.

    # DÉROULÉ DE LA CONVERSATION
    Tu t'es déjà présenté dans le premier message de l'historique, qui pose aussi la question 1. Ne te représente jamais.
    Tu poses 4 questions, une par message, dans cet ordre :
    1. Le profil visé : genre et tranche d'âge adulte (déjà posée dans le premier message).
    2. L'univers qui l'intéresse : luxe/patrimoine, tech/business, showbiz/sport ou autre.
    3. La carte à jouer : charme/séduction ou partenaire de confiance (des ressorts de fiction, pas des techniques à utiliser sur une vraie personne).
    4. Le montant qu'il voudrait sur son compte pour que ça « vaille le coup » (un élément humoristique du jeu, jamais un objectif d'action).

    Règle de passage : quand l'utilisateur a répondu à la question N, ton message pose directement la question N+1.
    N'ajoute jamais de question de précision, de sous-choix ou de confirmation : toute réponse plausible suffit.
    Si l'utilisateur ne répond pas du tout à la question, taquine-le gentiment et repose la même question.

    Dès que l'utilisateur a répondu à la question 4, dans ce même message et sans poser d'autre question :
    - utilise l'outil search_internet (1 à 3 recherches) pour trouver trois personnalités réelles, vivantes, célèbres et fortunées qui collent aux réponses ;
    - présente-les numérotées 1, 2 et 3 : nom, fortune estimée avec sa source et sa période, une courte vanne ;
    - si la recherche échoue, propose quand même trois personnalités vivantes que tu connais, en précisant que les chiffres sont approximatifs ;
    - termine en demandant de choisir 1, 2 ou 3.

    Quand l'utilisateur a choisi 1, 2 ou 3 : envoie le masterplan au format JSON décrit plus bas.

    # FORMAT DES MESSAGES TEXTE
    Tous les messages, sauf le masterplan, sont du texte normal pour l'utilisateur, jamais du JSON.
    Messages de question : 2 à 4 lignes. Une vanne courte sur sa dernière réponse, puis la question suivante.
    N'écris ni numéro d'étape, ni intitulé du type « Récap : », « Vanne : » ou « Question : ».

    # FORMAT DU MASTERPLAN (lu par l'application, pas par l'utilisateur)
    Réponds uniquement avec un JSON valide : rien avant, rien après, pas de bloc Markdown, uniquement des guillemets droits.
    Exactement 5 tâches, dans l'ordre chronologique, toutes fictives, loufoques et inoffensives : aucune ne doit impliquer de contacter, séduire, suivre, tromper ou solliciter financièrement la personne.
    {
      "target_name": "Nom de la personnalité choisie",
      "tasks": [
        { "description": "Titre court : tâche parodique en 1 ou 2 phrases." }
      ]
    }
  INSTRUCTIONS

  def create
    @chat = current_user.chats.find(params[:chat_id])
    @message = @chat.messages.new(message_params)
    @message.role = "user"

    if @message.save
      # initialisation du LLM chat + accès au tool de recherche internet
      llm_chat = RubyLLM.chat.with_instructions(INSTRUCTIONS).with_tools(SearchInternetTool)
      # itération sur les messages sans le dernier message
      @chat.messages.where.not(id: @message.id).where.not(content: [nil, ""]).order(created_at: :asc).each do |message|
        # on ajoute les messages précédents au dernier message par ordre chrono
        llm_chat.add_message(role: message.role.to_sym, content: message.content)
      end
      # bulle vide du coach, broadcastée tout de suite (affiche « … » en attendant)
      @assistant_message = @chat.messages.create!(role: "assistant", content: "")
      # on pose la question au LLM en streaming : chaque morceau est broadcasté dans la bulle
      response = llm_chat.ask(@message.content) { |chunk| stream_chunk(chunk) }
      # on enregistre la réponse complète dans la base
      @assistant_message.update!(content: response.content.presence || @assistant_message.content)
      # on crée le titre du message sur la base du premier message
      @chat.generate_title_from_first_message
      # on parse le JSON renvoyé par le LLM en dernier message
      data = parse_masterplan(@assistant_message.content)
      # on crée le masterplan
      create_masterplan!(@assistant_message, data) if data
      # dernier broadcast : version finale de la bulle
      # reload : recharge le message pour qu'il "voie" le masterplan qui vient d'être créé
      @assistant_message.reload
      if @assistant_message.masterplan
        # masterplan : la bulle ELLE-MÊME doit changer (classe message__bubble--masterplan = style carte),
        # donc on REMPLACE tout le message (replace) -> 1 pop + le rire de validation
        @assistant_message.broadcast_bubble
      else
        # texte : seul le CONTENU de la bulle change (update) -> pas de pop ni de son en plus
        @assistant_message.broadcast_content
      end
      # affichage sans rechargement avec turbostream et fallback html si turbo inactif sur nav
      respond_to do |format|
        format.turbo_stream
        format.html { redirect_to chat_path(@chat) }
      end
    else
      # affichage turbo du formulaire en cas d'échec et fallback html si turbo inactif sur nav
      respond_to do |format|
        format.turbo_stream do
          render turbo_stream: turbo_stream.update("new_message_container",
          partial: "messages/form",
          locals: { chat: @chat, message: @message }),
          status: :unprocessable_content
        end
        format.html do
          @messages = @chat.messages.order(created_at: :asc).includes(:masterplan)
          render "chats/show", status: :unprocessable_content
        end
      end
    end
  end

  private

  # Ajoute le morceau reçu au message du coach et met à jour sa bulle en direct.
  # Les morceaux sans texte (appels au tool de recherche) sont ignorés, et le JSON
  # du masterplan n'est pas affiché : la bulle garde « … » jusqu'à la carte finale.
  def stream_chunk(chunk)
    # pas blank? : un morceau peut n'être qu'un espace ou un retour à la ligne
    text = chunk.content.to_s
    return if text.empty?

    @assistant_message.content += text
    @assistant_message.broadcast_content unless @assistant_message.content.lstrip.start_with?("{")
  end

  def message_params
    params.require(:message).permit(:content)
  end

  def parse_masterplan(content)
    # parser le contenu
    final_assistant_answer = JSON.parse(content)
    final_assistant_answer.is_a?(Hash) && final_assistant_answer.key?("target_name") && final_assistant_answer.key?("tasks") ? final_assistant_answer : nil
    # renvoyer nil si le parsing echoue
  rescue JSON::ParserError
    nil
  end

  def create_masterplan!(message, data)
    # transaction pour garantir que toutes les tâches sont transformées
    ActiveRecord::Base.transaction do
      # créer le masterplan
      masterplan = current_user.masterplans.create!(message: message, target_name: data["target_name"])
      # itérer sur les "tasks" du hash renvoyé pour créer les tasks
      data["tasks"].each do |task|
        masterplan.tasks.create!(description: task["description"])
      end
      # renommer le chat avec le nom du masterplan
      @chat.rename_after_target(masterplan.target_name)
    end
  end
end
