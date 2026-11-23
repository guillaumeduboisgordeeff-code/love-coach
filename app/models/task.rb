class Task < ApplicationRecord
  belongs_to :masterplan
  validates :description, presence: true
end
