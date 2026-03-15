class CreateUsers < ActiveRecord::Migration
  def change
    create_table :users do |t|
      t.string :name
      t.string :email
      t.boolean :guac
      t.boolean :beer
      t.boolean :other

      t.timestamps
    end
  end
end
