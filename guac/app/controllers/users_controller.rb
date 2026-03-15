class UsersController < ApplicationController
  def show
    @user = User.find(params[:id])
  end

  def new
  	@user = User.new
  end

  def new_wfh
    
    puts "hi"
  end

  def create
  	@user = User.new(params[:user])
  	if @user.save
      redirect_to @user
  	else
  		render 'shared/_error_messages'
  	end
  end
end
