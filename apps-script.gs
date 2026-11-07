// Elemental Match 测试数据接收器（Google Apps Script）
// 表格第一行（表头）必须是：ts | type | event | variant | sid | src | camp | ad | w | email | lang

var HEAD = ['ts','type','event','variant','sid','src','camp','ad','w','email','lang'];

function doPost(e) {
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var row = HEAD.map(function (k) { return d[k] === undefined ? '' : String(d[k]).slice(0, 200); });
    sh.appendRow(row);
  } catch (err) {}
  return ContentService.createTextOutput('ok');
}

// 漏斗统计：纯函数，rows 为二维数组（不含表头）
function summarize(rows) {
  var by = {};
  rows.forEach(function (r) {
    var ev = r[2] || (r[1] === 'waitlist' ? 'waitlist' : '');
    if (!ev) return;
    var key = (r[5] || '(none)') + ' | ' + (r[3] || '-') + ' | ' + (r[10] || '-');
    by[key] = by[key] || {};
    by[key][ev] = by[key][ev] || {};
    by[key][ev][r[4]] = 1;            // 按 sid 去重 = 人数
  });
  var out = [];
  Object.keys(by).sort().forEach(function (k) {
    var c = function (e) { return by[k][e] ? Object.keys(by[k][e]).length : 0; };
    var v = c('em_view');
    var pct = function (n) { return v ? Math.round(n / v * 1000) / 10 + '%' : '-'; };
    out.push({ key: k, view: v, start: c('em_form_start'), calc: c('em_calc'), quest: c('em_quest_done'),
      share: c('em_copy_share') + c('em_image_made'), paywall: c('em_paywall_click'), wait: c('waitlist'),
      calc_pct: pct(c('em_calc')), quest_pct: pct(c('em_quest_done')), paywall_pct: pct(c('em_paywall_click')) });
  });
  return out;
}

function doGet() {
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var vals = sh.getDataRange().getValues().slice(1);
  var s = summarize(vals);
  var h = '<meta name=viewport content="width=device-width"><body style="font-family:sans-serif;padding:12px"><h3>漏斗（按人数，同一次访问去重）</h3><table border=1 cellpadding=6 style="border-collapse:collapse"><tr><th>来源 | 版本 | 语言<th>访问<th>开始填<th>算出结果<th>通关<th>分享<th>点付费<th>留邮箱<th>算出率<th>通关率<th>付费点击率</tr>';
  s.forEach(function (r) {
    h += '<tr><td>' + r.key + '<td>' + r.view + '<td>' + r.start + '<td>' + r.calc + '<td>' + r.quest + '<td>' + r.share + '<td>' + r.paywall + '<td>' + r.wait + '<td>' + r.calc_pct + '<td>' + r.quest_pct + '<td>' + r.paywall_pct + '</tr>';
  });
  return HtmlService.createHtmlOutput(h + '</table>');
}
