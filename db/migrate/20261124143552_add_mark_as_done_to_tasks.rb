class AddMarkAsDoneToTasks < ActiveRecord::Migration[8.1]
  def change
    add_column :tasks, :mark_as_done, :boolean, default: false, null: false
  end
end
