class RenameMarAsDoneforTasks < ActiveRecord::Migration[8.1]
  def change
    rename_column :tasks, :mark_as_done, :done
  end
end
