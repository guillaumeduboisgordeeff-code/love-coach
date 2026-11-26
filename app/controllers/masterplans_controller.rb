class MasterplansController < ApplicationController
  def index
    @masterplans = current_user.masterplans
  end

  # app/controllers/masterplans_controller.rb
  def show # Définit l'action qui affiche un masterplan
    @masterplan = Masterplan.find(params[:id]) # Récupère le masterplan correspondant à l'identifiant de l'URL
  end
end
