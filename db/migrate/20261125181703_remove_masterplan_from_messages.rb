class RemoveMasterplanFromMessages < ActiveRecord::Migration[8.1]
  def change
    remove_column :messages, :masterplan, :boolean, default: false, null: false
  end
end
