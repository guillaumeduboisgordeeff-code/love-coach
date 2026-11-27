class PagesController < ApplicationController
  skip_before_action :authenticate_user!, only: [:home, :anciens_souls]

  def home
  end

  def anciens_souls
  end
end
