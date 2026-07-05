// api.js — RSS ニュースフィード取得 & gBizINFO API 連携

/**
 * RSSニュースフィードを取得する
 * rss2json.com を経由してCORS制約を回避し、JSONとして受け取る
 * @param {string} feedUrl - rss2json.com 形式のURL（store.js の settings.rssFeedUrl に格納）
 * @param {number} count - 取得する記事数（デフォルト: 5）
 * @returns {Promise<Array<{title: string, link: string, pubDate: string, description: string}>>}
 */
export async function fetchNewsFromRSS(feedUrl, count = 5) {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (data.status !== 'ok' || !Array.isArray(data.items)) {
      throw new Error('Invalid RSS response');
    }

    return data.items.slice(0, count).map(item => ({
      title: item.title || '（タイトルなし）',
      link: item.link || '#',
      pubDate: item.pubDate || '',
      description: (item.description || '').replace(/<[^>]*>/g, '').substring(0, 100)
    }));
  } catch (err) {
    console.warn('RSSフィード取得エラー:', err);
    return [];
  }
}

/**
 * gBizINFO API で企業情報を検索する
 * @param {string} companyName - 検索する企業名
 * @param {string} apiToken - gBizINFO APIトークン
 * @returns {Promise<Object|null>} 企業情報（corporateNumber, name, location, capitalStock 等）
 */
export async function searchCompanyByGBiz(companyName, apiToken) {
  if (!apiToken || !companyName) return null;

  try {
    const url = `https://info.gbiz.go.jp/hojin/v1/hojin?name=${encodeURIComponent(companyName)}&page=1&limit=5`;
    const response = await fetch(url, {
      headers: {
        'X-hojinInfo-api-token': apiToken,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();

    if (!data['hojin-infos'] || data['hojin-infos'].length === 0) {
      return null;
    }

    // 最も近い結果を返す
    const info = data['hojin-infos'][0];
    return {
      corporateNumber: info.corporate_number || '',
      name: info.name || '',
      location: info.location || '',
      capitalStock: info.capital_stock ? `${(info.capital_stock / 100000000).toFixed(1)}億円` : '',
      employeeNumber: info.employee_number || '',
      dateOfEstablishment: info.date_of_establishment || ''
    };
  } catch (err) {
    console.warn('gBizINFO API エラー:', err);
    return null;
  }
}
