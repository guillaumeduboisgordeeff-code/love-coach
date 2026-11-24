class ChatsController < ApplicationController
  def show
    @chat = current_user.chats.find(params[:id])
    @messages = @chat.messages.order(created_at: :desc)
    @message = Message.new
  end
end
