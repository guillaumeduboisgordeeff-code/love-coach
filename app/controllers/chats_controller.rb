class ChatsController < ApplicationController
  def create
    @chat = current_user.chats.create!(title: Chat::DEFAULT_TITLE)
    @chat.messages.create!(role: "assistant", content: <<~TEXT)
    Salut, c’est Jean-Ed, ancien pisciniste reconverti dans le coaching de l’amour...
    Non je déconne ! Je suis là pour t’aider à faire le grand plongeon en eaux très fortunées.
    Quel genre et quel âge tu vises ?
    TEXT
    redirect_to chat_path(@chat)
  end

  def show
    @chat = current_user.chats.find(params[:id])
    @messages = @chat.messages.order(created_at: :asc).includes(:masterplan)
    @message = Message.new
  end
end
