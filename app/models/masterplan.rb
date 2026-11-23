class Masterplan < ApplicationRecord
  belongs_to :message
  belongs_to :user
  has_one :chat, through: :message
  has_many :tasks, dependent: :destroy
  validates :message_id, uniqueness: true
end
