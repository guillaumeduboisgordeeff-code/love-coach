class MasterplansController < ApplicationController
  def index
    @masterplans = current_user.masterplans
  end

  def show
    @masterplan = current_user.masterplans.find(params[:id])
  end

  def destroy
    @masterplan = current_user.masterplans.find(params[:id])
    @masterplan.destroy

    redirect_to masterplans_path, notice: "Masterplan supprimé."
  end
end
