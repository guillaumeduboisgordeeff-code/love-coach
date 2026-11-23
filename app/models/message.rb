class Message < ApplicationRecord
  belongs_to :chat
  has_one :masterplan, dependent: :destroy
  validates :content, presence: true
end
