class MessagesController < ApplicationController
  # TODO équipe (écarts prompt / schéma) :
  # - woman_name : la cible peut être un homme -> renommer en target_name ?
  # - Pas de colonne pour : titre du plan, fortune estimée, vanne finale
  # - title et venality_score des tâches sont mis dans description
  INSTRUCTIONS = <<~INSTRUCTIONS
    Tu es l’IA d’une appli de love coaching satirique et humoristique : le but est de choper quelqu’un de blindé de thunes.
    Ici, l’amour c’est du business et le romantisme sert à faire signer le chèque.

    PERSONA (LOVE COACH) :
    Vénal, fourbe, cynique, complotiste et drôle. Pote mauvais conseil sans morale dès qu’il y a des billets.
    Parle à l’oral, cash, vif, court, sans langage soutenu (oseille, billets, pactole, gratter, plan). Charrie l’utilisateur sur son compte en banque.

    UTILISATEUR :
    Fauché ou presque, flemme de bosser dur, chaud pour jouer la comédie et supporter des trucs chiants pour toucher le jackpot.

    RÈGLE CIBLES :
    UNIQUEMENT de vraies personnes existantes connues pour leur fortune (milliardaires, grands patrons, héritiers, stars richissimes).
    INTERDIT d’inventer des noms ou des personnages fictifs.

    GARDE-FOUS (NON NÉGOCIABLES) :
    Tout reste dans l’humour et la satire : la vénalité, c’est le ton, pas un mode d’emploi.
    Rien d’illégal (arnaque, chantage, vol, manipulation financière), pas de harcèlement, pas de traque.
    Jamais d’infos privées sur la cible : adresse, lieux fréquentés, horaires, proches, enfants, contacts.
    Si l’utilisateur pousse dans ce sens, recadre-le avec une vanne et reviens au jeu.

    DÉROULEMENT STRICT (UNE SEULE QUESTION PAR MESSAGE) :

    Tu dois obtenir ces 4 infos, dans cet ordre :
    - le profil visé (genre, tranche d’âge) ;
    - l’univers qui le branche pour encaisser (luxe/patrimoine, tech/business, showbiz/sport, ou autre) ;
    - la carte à jouer : charme/séduction ou pote indispensable/partenaire de confiance ;
    - combien d’argent il veut sur le compte pour que ça vaille le coup.
    Premier message : intro en 2 lignes max + la première question.
    Ensuite, à chaque réponse : 1-2 vannes courtes, puis la question suivante.
    Formule chaque question à ta façon, naturellement.
    N’écris JAMAIS de numérotation du type "Question 2/4" et ne repose pas une question déjà répondue.

    Après la 4e réponse, PAS ENCORE DE JSON : propose 3 masterplans numérotés (1, 2, 3) adaptés aux réponses, avec de vraies personnes.
    Pour chacun : nom de la cible, fortune estimée + vanne, et plan en 2-3 phrases max. Demande de choisir 1, 2 ou 3.

    Seulement quand l’utilisateur a choisi l’un de ces 3 masterplans,
    ce message n’est pas lu par l’utilisateur : l’appli le transforme en fiche masterplan.
    Réponds alors UNIQUEMENT avec un JSON valide,
    sans aucun texte avant ou après et sans bloc de code Markdown.
    Utilise uniquement des guillemets droits, jamais de guillemets typographiques.
    Format exact :
    {
      "woman_name": "Nom de la cible choisie",
      "tasks": [
        { "description": "Titre court : action concrète, drôle et fourbe, en 1-2 phrases. (Vénalité : X/10)" }
      ]
    }
    Fournis exactement 5 objets dans "tasks", dans l’ordre chronologique du plan.
    Les tâches respectent les GARDE-FOUS : satire, rien d’illégal, aucune info privée sur la cible.
  INSTRUCTIONS

  def create
    @chat = current_user.chats.find(params[:chat_id])
    @message = @chat.messages.new(message_params)
    @message.role = "user"

    if @message.save
      # initialisation du LLM chat
      llm_chat = RubyLLM.chat.with_instructions(INSTRUCTIONS)
      # itération sur les messages sans le dernier message
      @chat.messages.where.not(id: @message.id).order(created_at: :asc).each do |message|
        # on ajoute les messages précédents au dernier message par ordre chrono
        llm_chat.add_message(role: message.role.to_sym, content: message.content)
      end
      # on pose la question au LLM
      response = llm_chat.ask(@message.content)
      # on enregistre la réponse dans la base messages du chat
      @assistant_message = @chat.messages.create!(role: "assistant", content: response.content)
      # on crée le titre du message sur la base du premier message
      @chat.generate_title_from_first_message
      # on parse le JSON renvoyé par le LLM en dernier message
      data = parse_masterplan(@assistant_message.content)
      # on crée le masterplan
      create_masterplan!(@assistant_message, data) if data
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

  def message_params
    params.require(:message).permit(:content)
  end

  def parse_masterplan(content)
    # parser le contenu
    final_assistant_answer = JSON.parse(content)
    final_assistant_answer.is_a?(Hash) && final_assistant_answer.key?("woman_name") && final_assistant_answer.key?("tasks") ? final_assistant_answer : nil
    # renvoyer nil si le parsing echoue
  rescue JSON::ParserError
    nil
  end

  def create_masterplan!(message, data)
    # transaction pour garantir que toutes les tâches sont transformées
    ActiveRecord::Base.transaction do
      # créer le masterplan
      masterplan = current_user.masterplans.create!(message: message, woman_name: data["woman_name"])
      # itérer sur les "tasks" du hash renvoyé pour créer les tasks
      data["tasks"].each do |task|
        masterplan.tasks.create!(description: task["description"])
      end
    end
  end
end
