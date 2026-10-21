/* =========================================================
 * MOVA 動空間｜簡報用模擬資料（全部為虛構示意數據）
 * 修改這個檔案即可更換簡報中的門市、財務與募資數字
 * ========================================================= */
window.DECK_DATA = {
  phases: {
    1: { name: '第一階段', status: '已營運', period: '2025 Q4 – 2026 Q2', color: '#1E3A8A' },
    2: { name: '第二階段', status: '籌備中', period: '2027 H1', color: '#FF6B35' },
    3: { name: '第三階段', status: '規劃中', period: '2027 H2 – 2028', color: '#0EA5A4' }
  },

  // invest / revenue 單位：萬元（NT$）；area 單位：坪
  stores: [
    { id: 'xinyi',     name: '信義旗艦店', city: '台北市', district: '信義區', lat: 25.0336, lng: 121.5648, phase: 1, open: '2025-11', invest: 120, revenue: 520, area: 85, type: '旗艦店' },
    { id: 'daan',      name: '大安店',     city: '台北市', district: '大安區', lat: 25.0263, lng: 121.5436, phase: 1, open: '2026-03', invest: 95,  revenue: 450, area: 60, type: '標準店' },
    { id: 'banqiao',   name: '板橋店',     city: '新北市', district: '板橋區', lat: 25.0136, lng: 121.4627, phase: 1, open: '2026-06', invest: 90,  revenue: 410, area: 55, type: '標準店' },

    { id: 'neihu',     name: '內湖科技店', city: '台北市', district: '內湖區', lat: 25.0795, lng: 121.5755, phase: 2, open: '2027-02', invest: 90,  revenue: 470, area: 58, type: '標準店' },
    { id: 'xinzhuang', name: '新莊店',     city: '新北市', district: '新莊區', lat: 25.0360, lng: 121.4500, phase: 2, open: '2027-03', invest: 85,  revenue: 400, area: 52, type: '標準店' },
    { id: 'taoyuan',   name: '桃園藝文店', city: '桃園市', district: '桃園區', lat: 24.9936, lng: 121.3010, phase: 2, open: '2027-04', invest: 85,  revenue: 390, area: 55, type: '標準店' },
    { id: 'taichung7', name: '台中七期店', city: '台中市', district: '西屯區', lat: 24.1630, lng: 120.6400, phase: 2, open: '2027-05', invest: 110, revenue: 480, area: 80, type: '旗艦店' },
    { id: 'zhubei',    name: '竹北高鐵店', city: '新竹縣', district: '竹北市', lat: 24.8270, lng: 121.0130, phase: 2, open: '2027-06', invest: 85,  revenue: 420, area: 52, type: '標準店' },

    { id: 'beitun',    name: '台中北屯店', city: '台中市', district: '北屯區', lat: 24.1820, lng: 120.6860, phase: 3, open: '2027-09', invest: 85,  revenue: 380, area: 55, type: '標準店' },
    { id: 'zuoying',   name: '高雄左營店', city: '高雄市', district: '左營區', lat: 22.6870, lng: 120.3070, phase: 3, open: '2027-11', invest: 105, revenue: 450, area: 75, type: '旗艦店' },
    { id: 'tainan',    name: '台南東區店', city: '台南市', district: '東區',   lat: 22.9870, lng: 120.2180, phase: 3, open: '2028-01', invest: 85,  revenue: 370, area: 55, type: '標準店' },
    { id: 'lingya',    name: '高雄苓雅店', city: '高雄市', district: '苓雅區', lat: 22.6210, lng: 120.3120, phase: 3, open: '2028-03', invest: 85,  revenue: 360, area: 50, type: '標準店' },
    { id: 'chiayi',    name: '嘉義西區店', city: '嘉義市', district: '西區',   lat: 23.4800, lng: 120.4490, phase: 3, open: '2028-05', invest: 80,  revenue: 320, area: 50, type: '社區店' },
    { id: 'yilan',     name: '宜蘭市店',   city: '宜蘭縣', district: '宜蘭市', lat: 24.7570, lng: 121.7530, phase: 3, open: '2028-06', invest: 80,  revenue: 310, area: 48, type: '社區店' }
  ],

  // 募資模擬：取得資金後依此順序展店
  expansionQueue: ['neihu', 'xinzhuang', 'taoyuan', 'taichung7', 'zhubei', 'beitun', 'zuoying', 'tainan', 'lingya', 'chiayi', 'yilan'],

  fund: {
    min: 300, max: 1000, step: 50, presets: [300, 500, 1000], defaultValue: 500,
    capexPerStore: 85,          // 每家新店平均資本支出（萬）
    startMonth: '2026-12',      // 資金到位月份
    allocation: [
      { key: 'store',   label: '門市展店',      share: 0.70, color: '#FF6B35' },
      { key: 'tech',    label: '智慧系統與 App', share: 0.12, color: '#1E3A8A' },
      { key: 'mkt',     label: '品牌行銷',      share: 0.10, color: '#0EA5A4' },
      { key: 'ops',     label: '營運週轉金',    share: 0.08, color: '#CBD5E1' }
    ]
  },

  // 財務預測（營收單位：萬元）
  finance: {
    years: [2026, 2027, 2028, 2029, 2030],
    scenarios: {
      conservative: { label: '保守', revenue: [1380, 3350, 6620, 10650, 15480], margin: [-0.18, -0.01, 0.10, 0.16, 0.20], stores: [3, 9, 14, 20, 26] },
      base:         { label: '基準', revenue: [1380, 4650, 9200, 14800, 21500], margin: [-0.12, 0.05, 0.16, 0.22, 0.26], stores: [3, 11, 18, 26, 35] },
      optimistic:   { label: '樂觀', revenue: [1380, 5950, 11780, 18940, 27520], margin: [-0.08, 0.09, 0.20, 0.26, 0.30], stores: [3, 13, 22, 32, 44] }
    }
  }
};
