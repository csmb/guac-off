FactoryGirl.define do
	factory :user do
		name			"Chris Bunting"
		email 		"chris@homerun.com"
		password 	"foobar"
		password_confirmation "foobar"
	end
end