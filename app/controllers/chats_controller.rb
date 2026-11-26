class ChatsController < ApplicationController
  def create
    @chat = current_user.chats.create!(title: Chat::DEFAULT_TITLE)
    redirect_to chat_path(@chat)
  end

  def show
    @chat = current_user.chats.find(params[:id])
    @messages = @chat.messages.order(created_at: :asc).includes(:masterplan)
    @message = Message.new
  end
end
