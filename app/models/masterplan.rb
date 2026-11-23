class Masterplan < ApplicationRecord
  belongs_to :message
  belongs_to :user
  has_many :tasks, dependent: :destroy
end
