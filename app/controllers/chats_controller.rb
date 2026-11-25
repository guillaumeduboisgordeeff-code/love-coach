class ChatsController < ApplicationController
  def create
    @chat = current_user.chats.create!(title: "Nouvelle cible")
    redirect_to chat_path(@chat)
  end

  def show
    @chat = current_user.chats.find(params[:id])
    @messages = @chat.messages.order(created_at: :asc)
    @message = Message.new
  end
end
