require 'sinatra'
require 'data_mapper'

SITE_TITLE = "Mission Guac Party 2013"

DataMapper.setup(:default, ENV['DATABASE_URL'] || 'postgres://#{Dir.pwd}/partiers.db')
class Partier
  include DataMapper::Resource
  property :id, Serial
  property :name, Text, :required => true
  property :email, Text, :required => true
  property :guacamole, Boolean
  property :beer, Boolean
  property :something_else, Boolean
  property :created_at, DateTime
  property :updated_at, DateTime
end
DataMapper.finalize.auto_upgrade!


get '/' do
  erb :home
end

get '/signup' do
  erb :signup
end

post '/signup' do
  p = Partier.new
  p.name = params[:name]
  p.email = params[:email]
  p.guacamole = params[:guacamole]
  p.beer = params[:beer]
  p.something_else = params[:something_else]
  p.created_at = Time.now
  p.updated_at = Time.now
  p.save

  redirect "/guacamole_enthusiast/#{p.id}"
end

get '/guacamole_enthusiast/:id' do
  @partier = Partier.get params[:id]
  if @partier
    erb :confirmed
  else
    redirect '/'
  end
end

get '/guacamole_enthusiast/' do
  redirect '/signup'
end
