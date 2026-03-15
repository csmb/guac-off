# this year's festivities has folks voting on 5 different categories.
# person a will read off each card's categories in the same order, and
# person b will input the code in `votes`

votes = [1,2,3,2,2,1,4,3,1,3,1,6,5,7,7,7,7,4,6,2,4,5,1,5,1,5,1,3,5,1]

categories = [[],[],[],[],[]]

votes.each_slice(5) do |vote_vector|
  categories.each_with_index do |cat, idx|
    cat.push(vote_vector[idx])
  end
end

n = 0
categories.each do |s|
  w = Hash.new(0)
  s.each do |n|
    w[n] += 1
  end
  n += 1
  puts "Category #{n}:"
  w.sort_by {|k,v| v}.reverse.each do |k,v|
    puts "Guac code #{k} had #{v} votes."
  end
end
