class MasterplansController < ApplicationController
  def index
    @masterplans = current_user.masterplans
  end

  def show
  end
end
