class Message < ApplicationRecord
  belongs_to :chat
  has_one :masterplan, dependent: :destroy
  # la réponse du coach est créée vide puis remplie au fil du streaming
  validates :content, presence: true, if: -> { role == "user" }

  # chaque nouveau message (user ou coach) est ajouté en direct dans la page du chat
  after_create_commit lambda {
    broadcast_append_to chat, target: "messages", partial: "chats/message", locals: { message: self }
  }

  # remplace la bulle du message dans la page (appelé à chaque morceau reçu du LLM)
  def broadcast_bubble
    broadcast_replace_to chat, partial: "chats/message", locals: { message: self }
  end

  # méthode de mise à jour du contenu en streaming
  def broadcast_content
    broadcast_update_to chat, target: ActionView::RecordIdentifier.dom_id(self, :content), partial: "chats/message_content", locals: { message: self }
  end
end
