class RenameWomanNameToTargetNameInMasterplans < ActiveRecord::Migration[8.1]
  # la cible peut être un homme ou une femme : on passe à un nom neutre
  def change
    rename_column :masterplans, :woman_name, :target_name
  end
end
