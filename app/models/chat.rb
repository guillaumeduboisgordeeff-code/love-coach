class Chat < ApplicationRecord
  belongs_to :user
  has_many :messages, dependent: :destroy
  validates :title, presence: true

  DEFAULT_TITLE = "Nouvelle cible"
  TITLE_PROMPT = <<~PROMPT
    Crée une courte description de 3 à 6 mots qui résume la question de l'utilisateur et fais en le titre de la conversation.
    Réponds uniquement par le titre, en texte brut : sans Markdown, sans #, sans guillemets, sans ponctuation finale.
  PROMPT

  def generate_title_from_first_message
    return unless title == DEFAULT_TITLE

    first_user_message = messages.where(role: "user").order(:created_at).first
    return if first_user_message.nil?

    response = RubyLLM.chat.with_instructions(TITLE_PROMPT).ask(first_user_message.content)
    update(title: response.content.delete('"#*').delete)
  end
end
