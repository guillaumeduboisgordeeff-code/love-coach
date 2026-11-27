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


masterplans = [ # Prépare les données des masterplans.

  # ---- Masterplans d'Antoine pour Beyoncé ----
  { user: user1, target_name: "Beyoncé", tasks: [
    ["Apprendre l'anglais couramment", false],          # Étape accessible : parler sa langue.
    ["Composer une chanson dédiée à Beyoncé", false],   # Étape cohérente : c'est une chanteuse.
    ["Créer une fausse page Wikipedia de notre rencontre", false], # Étape loufoque.
    ["Assister à un concert de la Renaissance Tour", false],       # Étape réaliste pour la voir.
    ["Se faire remarquer par la team Beyhive", true]    # Première tâche déjà accomplie.
  ] }, # Masterplan 1 d'Antoine.

  # ---- Masterplans d'Antoine pour Shakira ----
  { user: user1, target_name: "Shakira", tasks: [
    ["Apprendre l'espagnol", false],                        # Étape accessible : sa langue maternelle.
    ["Prendre des cours de danse du ventre", false],        # Étape cohérente : elle danse.
    ["Faire croire à la presse qu'on est en couple", false], # Étape loufoque.
    ["Envoyer une démo de chanson à son label", false],     # Étape pour se faire connaître d'elle.
    ["Apprendre par cœur tous ses albums", true]            # Tâche déjà terminée.
  ] }, # Masterplan 2 d'Antoine.

  # ---- Masterplans d'Antoine pour Angela Kermek ----
  { user: user1, target_name: "Angela Kermek", tasks: [
    ["Apprendre l'allemand", false],                          # Étape accessible : parler sa langue.
    ["Découvrir les industries dont elle est propriétaire", false], # Étape cohérente : c'est une femme d'affaires.
    ["Inventer un lien de parenté imaginaire avec elle", false],    # Étape loufoque.
    ["Espionner discrètement ses stratégies d'investissement", false], # Étape pour comprendre son empire.
    ["Rejoindre un gala où elle est invitée", true]           # Tâche déjà accomplie.
  ] }, # Masterplan 3 d'Antoine.

  # ---- Masterplan de Thomas (inchangé) ----
  { user: user2, target_name: "Clara Bernard", tasks: [["Engager une conversation", false], ["Écouter ses centres d'intérêt", true]] } # Masterplan de Thomas.
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
