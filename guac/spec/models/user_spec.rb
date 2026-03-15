# == Schema Information
#
# Table name: users
#
#  id         :integer         not null, primary key
#  name       :string(255)
#  email      :string(255)
#  created_at :datetime        not null
#  updated_at :datetime        not null
#

require 'spec_helper'

describe User do
	before { @user = User.new(:name => "Example User", :email => "user@example.com") }

	subject { @user }

	it { should respond_to(:name) }
	it { should respond_to(:email) }

	it { should be_valid }

	describe "when a name is not present" do
		before { @user.name = ' ' }
		it { should_not be_valid }
	end

	describe "when a name is too long" do
		before { @user.name = 'a' * 51 }
		it { should_not be_valid }
	end

	describe "when an email address format is invalid" do
	   it "should be invalid" do
      addresses = %w[user@foo,com user_at_foo.org example.user@foo.
                     foo@bar_baz.com foo@bar+baz.com $$@me.net]
      addresses.each do |invalid_address|
        @user.email = invalid_address
        @user.should_not be_valid
      end      
    end
  end

  describe "when email format is valid" do
    it "should be valid" do
      addresses = %w[user@foo.COM A_US-E_R@f.b.org frst.lst@foo.jp a+b@baz.cn]
      addresses.each do |valid_address|
        @user.email = valid_address
        @user.should be_valid
      end
    end
  end

  describe "when an email address is already taken" do
  	before do
  		user_with_same_email = @user.dup
  		user_with_same_email.email = @user.email.upcase
  		user_with_same_email.save
  	end

  	it { should_not be_valid }
  end

  describe "email address with mixed case" do
  	let(:mixed_case_email) { "TeST@heLLo.COm" }

		it "should save the email in lowercase" do
	  	@user.email = mixed_case_email
	  	@user.save
	  	@user.reload.email.should == mixed_case_email.downcase
	  end
  end

  describe "mixed case email address should be valid" do
    before { @user.email = "TesT@hELLo.COm"}
    it { should be_valid }
  end
end