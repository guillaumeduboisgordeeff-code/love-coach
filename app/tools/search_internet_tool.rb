require "faraday"

# Tool donné au coach (RubyLLM) pour se renseigner sur internet avant de proposer
# des cibles. On interroge l'API publique de Wikipédia : pas de clé API, et on ne
# récupère que des infos publiques (fortune, carrière), jamais d'infos privées.
class SearchInternetTool < RubyLLM::Tool
  WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php".freeze
  MAX_RESULTS = 5
  SUMMARY_LENGTH = 600

  description <<~DESC
    Recherche sur internet (Wikipédia) des infos publiques sur des personnes réelles
    connues pour leur fortune : milliardaires, grands patrons, héritiers, stars.
    Utilise-le pour trouver ou vérifier les 3 profils avant de les proposer.
    Interdit de chercher des infos privées (adresse, lieux fréquentés, proches, enfants).
  DESC

  parameter :query,
            description: "Mots-clés de recherche en anglais, ex : 'female billionaire tech entrepreneur' " \
                         "ou 'Françoise Bettencourt Meyers net worth'"

  def execute(query:)
    Rails.logger.info("[SearchInternetTool] recherche : #{query}")
    titles = search_titles(query)
    return { results: [], message: "Aucun résultat pour « #{query} »" } if titles.empty?

    { results: summaries_for(titles) }
  rescue Faraday::Error => e
    # Le message d'erreur est renvoyé au LLM, qui peut reformuler ou continuer sans
    { error: "Recherche impossible : #{e.message}" }
  end

  private

  # 1) on cherche les pages Wikipédia qui correspondent à la requête
  def search_titles(query)
    data = get(list: "search", srsearch: query, srlimit: MAX_RESULTS)
    data.dig("query", "search").to_a.map { |result| result["title"] }
  end

  # 2) on récupère le résumé (intro) de chaque page trouvée
  def summaries_for(titles)
    data = get(prop: "extracts", exintro: 1, explaintext: 1, redirects: 1, titles: titles.join("|"))
    data.dig("query", "pages").to_h.values.map do |page|
      {
        name: page["title"],
        summary: page["extract"].to_s.truncate(SUMMARY_LENGTH),
        url: "https://en.wikipedia.org/wiki/#{ERB::Util.url_encode(page['title'].to_s.tr(' ', '_'))}"
      }
    end
  end

  def get(params)
    response = connection.get("", params.merge(action: "query", format: "json"))
    JSON.parse(response.body)
  end

  def connection
    @connection ||= Faraday.new(
      url: WIKIPEDIA_API,
      headers: { "User-Agent" => "https://github.com/guillaumeduboisgordeeff-code/love-coach" },
      request: { timeout: 10 }
    ) { |f| f.response :raise_error }
  end
end
