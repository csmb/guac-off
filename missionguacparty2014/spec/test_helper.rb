ENV['RACK_ENV'] = 'test'
require 'minitest/autorun'
require 'minitest/spec'
require 'rack/test'
require 'database_cleaner'

require File.expand_path '../../guac.rb', __FILE__
