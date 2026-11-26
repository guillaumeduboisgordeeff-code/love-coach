puts "Cleaning database..."
User.destroy_all
puts "Creating users..."

user1 = User.find_or_create_by!(email: "antoine@example.com") do |user| # Recherche Antoine ou le crée.
  user.first_name = "Antoine" # Définit son prénom.
  user.last_name = "Martin" # Définit son nom.
  user.password = "password123" # Définit son mot de passe.
end # Termine le bloc de création d’Antoine.

user2 = User.find_or_create_by!(email: "thomas@example.com") do |user| # Recherche Thomas ou le crée.
  user.first_name = "Thomas" # Définit son prénom.
  user.last_name = "Durand" # Définit son nom.
  user.password = "password123" # Définit son mot de passe.
end # Termine le bloc de création de Thomas.

puts "Creating masterplans..."


masterplans = [ # Prépare les données des cinq masterplans.
  { user: user1, target_name: "Camille Dubois", tasks: [["Préparer une première conversation", true], ["Trouver un sujet commun", false], ["Proposer une sortie respectueuse", false]] }, # Premier masterplan d’Antoine, avec des tâches terminées et à faire.
  { user: user1, target_name: "Éléonore Moreau", tasks: [["Choisir un lieu de rencontre", false], ["Préparer des sujets de discussion", false]] }, # Deuxième masterplan d’Antoine.
  { user: user1, target_name: "Inès Laurent", tasks: [["Faire connaissance", true], ["Proposer une activité", false]] }, # Troisième masterplan d’Antoine.
  { user: user1, target_name: "Margot Lefèvre", tasks: [["Envoyer un premier message", false], ["Organiser une sortie", false]] }, # Quatrième masterplan d’Antoine.
  { user: user2, target_name: "Clara Bernard", tasks: [["Engager une conversation", false], ["Écouter ses centres d’intérêt", true]] } # Masterplan de Thomas, différent de ceux d’Antoine.
] # Termine la liste des masterplans.



masterplans.each do |data| # Parcourt les données de chaque masterplan.
  chat = data[:user].chats.create!(title: data[:target_name]) # Crée un chat pour l’utilisateur concerné.
  message = chat.messages.create!(role: "assistant", content: "Masterplan pour #{data[:target_name]}") # Crée le message associé au masterplan.
  # message = chat.messages.build(role: "assistant", content: "Masterplan pour #{data[:target_name]}")
  # message[:masterplan] = true
  # message.save! #la ligne 23 est remplacé par les lignes : 24, 25, 26
  masterplan = data[:user].masterplans.create!(message: message, target_name: data[:target_name]) # Crée le masterplan lié à l’utilisateur et au message.

  data[:tasks].each do |description, done| # Parcourt les tâches et leur état.
    masterplan.tasks.create!(description: description, done: done)
  end # Termine la création des tâches de ce masterplan.
end # Termine la création des cinq masterplans.

puts "Finished"
