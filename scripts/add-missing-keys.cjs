// Add all missing i18n keys to zh.json, en.json, and all 5 lazy-loaded locales
const fs = require('fs');

// ── 1. Add missing keys to zh.json ──
const zh = JSON.parse(fs.readFileSync('src/i18n/locales/zh.json', 'utf8'));

// movie section additions
zh.movie.processing = "处理中...";
zh.movie.unit = "部";
zh.movie.set_wallpaper = "设为壁纸";
zh.movie.resume_text = "已从 {{min}}:{{sec}} 继续 · 点击从头播放";
zh.movie.watched = "已看";
zh.movie.external_player = "外部播放";
zh.movie.need_external_player = "需外部播放器";
zh.movie.regen_cover = "重新生成封面";

// game section additions
zh.game.search = "搜索游戏...";
zh.game.add_failed = "添加游戏失败";
zh.game.scan_steam = "扫描 Steam 游戏";
zh.game.close = "关闭";

// image section additions
zh.image.search = "搜索图片...";
zh.image.exit_fullscreen = "退出全屏 / Esc";
zh.image.tauri_only = "请使用 Tauri 桌面环境运行";
zh.image.select_folder = "选择文件夹导入";
zh.image.set_wallpaper = "设为壁纸";
zh.image.unit = "张";

// music section additions
zh.music.select_folder = "选择文件夹导入";
zh.music.unit = "首";

// batch namespace
zh.batch = {
  selected_count: "已选 {{n}} 项",
  select_all: "全选",
  invert: "反选",
  batch_tags: "批量标签",
  batch_delete: "批量删除",
  cancel: "取消",
  items_suffix: " 个项目",
};

// mediaScan namespace
zh.mediaScan = {
  no_new_media: "没有发现新媒体（已入库的自动跳过）",
  imported_n: "已导入 {{n}} {{unit}}",
  truncated: "（达单次 2000 上限，可再导一次）",
};

// bgTuner namespace
zh.bgTuner = {
  title: "背景视频调参",
  reset_default: "重置默认",
  playback_rate: "播放速率",
  first_start: "首次开始",
  first_start_hint: "0=从头",
  first_end: "首次结束",
  first_end_hint: "0=播完",
  loop_start: "循环起点",
  loop_start_hint: "每次循环从第几秒开始",
  loop_duration: "循环时长",
  loop_duration_hint: "每次循环播放多少秒",
  transition: "过渡时长",
  transition_hint: "两段视频交叉淡入淡出",
  loop_count: "循环次数",
  loop_count_hint: "0=无限循环",
  loop_count_unit: "次",
};

// privacy namespace
zh.privacy = {
  title: "帮助我们改进产品",
  description: "我们想收集匿名的使用数据来改进应用体验。这些数据仅包括：",
  item_themes: "您使用的主题和切换频率",
  item_usage: "各个功能的使用情况",
  item_crash: "应用崩溃和错误报告",
  disclaimer: "我们不会收集任何个人信息、文件内容或播放记录。所有数据完全匿名，仅用于优化产品体验。您可以随时在设置中更改此选项。",
  agree: "同意",
  decline: "拒绝",
};

// updateChecker namespace
zh.updateChecker = {
  new_version: "发现新版本",
  update_now: "立即更新",
  downloading: "正在下载...",
  manual_download: "手动下载 · GitHub",
};

// common namespace
zh.common = {
  set_wallpaper: "设为壁纸",
  tauri_only: "请使用 Tauri 桌面环境运行",
  dont_ask_again: "不再提示",
  player_bg_color: "播放器背景颜色",
  player_bg_disabled_hint: "请在设置 → 音乐 → 播放器背景中开启自定义",
  clear: "清除",
  opacity: "透明度",
};

fs.writeFileSync('src/i18n/locales/zh.json', JSON.stringify(zh, null, 2) + '\n');
console.log('zh.json updated');

// ── 2. Add missing keys to en.json ──
const en = JSON.parse(fs.readFileSync('src/i18n/locales/en.json', 'utf8'));

en.movie.processing = "Processing...";
en.movie.unit = "film"; en.movie.set_wallpaper = "Set as Wallpaper";
en.movie.resume_text = "Resumed from {{min}}:{{sec}} · Click to play from start";
en.movie.watched = "Watched";
en.movie.external_player = "External";
en.movie.need_external_player = "External Player Needed";
en.movie.regen_cover = "Regenerate Cover";
en.game.search = "Search games...";
en.game.add_failed = "Failed to add game";
en.game.scan_steam = "Scan Steam Games";
en.game.close = "Close";
en.image.search = "Search images...";
en.image.exit_fullscreen = "Exit Fullscreen / Esc";
en.image.tauri_only = "Please use Tauri desktop environment";
en.image.select_folder = "Select folder to import";
en.image.set_wallpaper = "Set as Wallpaper";
en.image.unit = "image";
en.music.select_folder = "Select folder to import";
en.music.unit = "song";
en.batch = {selected_count:"{{n}} selected",select_all:"Select All",invert:"Invert",batch_tags:"Batch Tags",batch_delete:"Batch Delete",cancel:"Cancel",items_suffix:" items"};
en.mediaScan = {no_new_media:"No new media found (already in library skipped)",imported_n:"Imported {{n}} {{unit}}",truncated:" (2000 limit reached; import again for more)"};
en.bgTuner = {title:"Background Video Tuner",reset_default:"Reset Default",playback_rate:"Playback Rate",first_start:"First Start",first_start_hint:"0=from start",first_end:"First End",first_end_hint:"0=to end",loop_start:"Loop Start",loop_start_hint:"Loop start position (seconds)",loop_duration:"Loop Duration",loop_duration_hint:"Loop playback duration (seconds)",transition:"Transition",transition_hint:"Cross-fade between segments",loop_count:"Loop Count",loop_count_hint:"0=infinite",loop_count_unit:"×"};
en.privacy = {title:"Help Us Improve",description:"We'd like to collect anonymous usage data to improve the app. This data only includes:",item_themes:"Themes you use and how often you switch",item_usage:"Feature usage statistics",item_crash:"App crash and error reports",disclaimer:"We do not collect any personal information, file contents, or playback history. All data is fully anonymized and only used for product improvement. You can change this anytime in Settings.",agree:"Agree",decline:"Decline"};
en.updateChecker = {new_version:"Update Available",update_now:"Update Now",downloading:"Downloading...",manual_download:"Download · GitHub"};
en.common = {set_wallpaper:"Set as Wallpaper",tauri_only:"Please use Tauri desktop environment",dont_ask_again:"Don't ask again",player_bg_color:"Player Background Color",player_bg_disabled_hint:"Enable custom background in Settings → Music → Player Background",clear:"Clear",opacity:"Opacity"};

fs.writeFileSync('src/i18n/locales/en.json', JSON.stringify(en, null, 2) + '\n');
console.log('en.json updated');

// ── 3. Fill ja/ko/de/fr/it with machine translations ──
const trans = {
  ja: {
    "movie.processing":"処理中...","movie.unit":"本","movie.set_wallpaper":"壁紙に設定","movie.resume_text":"{{min}}:{{sec}}から再開 · クリックで最初から再生","movie.watched":"視聴済み","movie.external_player":"外部","movie.need_external_player":"外部プレーヤーが必要","movie.regen_cover":"カバーを再生成",
    "game.search":"ゲームを検索...","game.add_failed":"ゲームの追加に失敗","game.scan_steam":"Steamゲームをスキャン","game.close":"閉じる",
    "image.search":"画像を検索...","image.exit_fullscreen":"全画面解除 / Esc","image.tauri_only":"Tauriデスクトップ環境を使用してください","image.select_folder":"フォルダを選択してインポート","image.set_wallpaper":"壁紙に設定","image.unit":"枚",
    "music.select_folder":"フォルダを選択してインポート","music.unit":"曲",
    "batch.selected_count":"{{n}}件選択中","batch.select_all":"すべて選択","batch.invert":"反転","batch.batch_tags":"一括タグ","batch.batch_delete":"一括削除","batch.cancel":"キャンセル","batch.items_suffix":" 項目",
    "mediaScan.no_new_media":"新しいメディアは見つかりませんでした（既存分はスキップ）","mediaScan.imported_n":"{{n}}{{unit}}をインポートしました","mediaScan.truncated":"（2000件の上限に達しました。もう一度インポートしてください）",
    "bgTuner.title":"背景動画チューナー","bgTuner.reset_default":"デフォルトに戻す","bgTuner.playback_rate":"再生速度","bgTuner.first_start":"初回開始","bgTuner.first_start_hint":"0=先頭から","bgTuner.first_end":"初回終了","bgTuner.first_end_hint":"0=最後まで","bgTuner.loop_start":"ループ開始","bgTuner.loop_start_hint":"ループ開始位置（秒）","bgTuner.loop_duration":"ループ時間","bgTuner.loop_duration_hint":"ループ再生時間（秒）","bgTuner.transition":"トランジション","bgTuner.transition_hint":"セグメント間のクロスフェード","bgTuner.loop_count":"ループ回数","bgTuner.loop_count_hint":"0=無限","bgTuner.loop_count_unit":"回",
    "privacy.title":"製品改善にご協力ください","privacy.description":"アプリ改善のため匿名の使用データを収集したいと考えています。以下のデータのみが含まれます：","privacy.item_themes":"使用テーマと切替頻度","privacy.item_usage":"各機能の使用状況","privacy.item_crash":"アプリのクラッシュとエラーレポート","privacy.disclaimer":"個人情報、ファイル内容、再生履歴は一切収集しません。すべてのデータは完全に匿名化され、製品改善のみに使用されます。この設定はいつでも変更できます。","privacy.agree":"同意する","privacy.decline":"拒否する",
    "updateChecker.new_version":"新しいバージョンがあります","updateChecker.update_now":"今すぐ更新","updateChecker.downloading":"ダウンロード中...","updateChecker.manual_download":"手動ダウンロード · GitHub",
    "common.set_wallpaper":"壁紙に設定","common.tauri_only":"Tauriデスクトップ環境を使用してください","common.dont_ask_again":"今後表示しない","common.player_bg_color":"プレーヤー背景色","common.player_bg_disabled_hint":"設定→音楽→プレーヤー背景でカスタムを有効にしてください","common.clear":"クリア","common.opacity":"透明度",
  },
  ko: {
    "movie.processing":"처리 중...","movie.unit":"편","movie.set_wallpaper":"배경화면으로 설정","movie.resume_text":"{{min}}:{{sec}}에서 이어서 재생 · 처음부터 재생","movie.watched":"시청함","movie.external_player":"외부","movie.need_external_player":"외부 플레이어 필요","movie.regen_cover":"커버 재생성",
    "game.search":"게임 검색...","game.add_failed":"게임 추가 실패","game.scan_steam":"Steam 게임 검색","game.close":"닫기",
    "image.search":"이미지 검색...","image.exit_fullscreen":"전체 화면 종료 / Esc","image.tauri_only":"Tauri 데스크톱 환경을 사용해 주세요","image.select_folder":"가져올 폴더 선택","image.set_wallpaper":"배경화면으로 설정","image.unit":"장",
    "music.select_folder":"가져올 폴더 선택","music.unit":"곡",
    "batch.selected_count":"{{n}}개 선택됨","batch.select_all":"전체 선택","batch.invert":"반전","batch.batch_tags":"일괄 태그","batch.batch_delete":"일괄 삭제","batch.cancel":"취소","batch.items_suffix":" 항목",
    "mediaScan.no_new_media":"새 미디어를 찾을 수 없습니다 (기존 항목은 건너뜀)","mediaScan.imported_n":"{{n}}{{unit}} 가져오기 완료","mediaScan.truncated":" (2000개 제한 도달; 다시 가져오세요)",
    "bgTuner.title":"배경 비디오 튜너","bgTuner.reset_default":"기본값으로 초기화","bgTuner.playback_rate":"재생 속도","bgTuner.first_start":"처음 시작","bgTuner.first_start_hint":"0=처음부터","bgTuner.first_end":"처음 종료","bgTuner.first_end_hint":"0=끝까지","bgTuner.loop_start":"반복 시작","bgTuner.loop_start_hint":"반복 시작 위치 (초)","bgTuner.loop_duration":"반복 길이","bgTuner.loop_duration_hint":"반복 재생 길이 (초)","bgTuner.transition":"전환","bgTuner.transition_hint":"세그먼트 간 크로스페이드","bgTuner.loop_count":"반복 횟수","bgTuner.loop_count_hint":"0=무한","bgTuner.loop_count_unit":"회",
    "privacy.title":"제품 개선에 도움 주세요","privacy.description":"앱 개선을 위해 익명의 사용 데이터를 수집하고자 합니다. 수집되는 데이터:","privacy.item_themes":"사용 중인 테마 및 전환 빈도","privacy.item_usage":"기능별 사용 통계","privacy.item_crash":"앱 충돌 및 오류 보고","privacy.disclaimer":"개인 정보, 파일 내용, 재생 기록은 수집하지 않습니다. 모든 데이터는 완전히 익명화되며 제품 개선에만 사용됩니다. 설정에서 언제든지 변경할 수 있습니다.","privacy.agree":"동의","privacy.decline":"거부",
    "updateChecker.new_version":"업데이트 가능","updateChecker.update_now":"지금 업데이트","updateChecker.downloading":"다운로드 중...","updateChecker.manual_download":"수동 다운로드 · GitHub",
    "common.set_wallpaper":"배경화면으로 설정","common.tauri_only":"Tauri 데스크톱 환경을 사용해 주세요","common.dont_ask_again":"다시 묻지 않음","common.player_bg_color":"플레이어 배경색","common.player_bg_disabled_hint":"설정 → 음악 → 플레이어 배경에서 사용자 지정을 활성화하세요","common.clear":"지우기","common.opacity":"투명도",
  },
  de: {
    "movie.processing":"Verarbeitung...","movie.unit":"Film","movie.set_wallpaper":"Als Hintergrund","movie.resume_text":"Von {{min}}:{{sec}} fortgesetzt · Klick für Neustart","movie.watched":"Gesehen","movie.external_player":"Extern","movie.need_external_player":"Externer Player nötig","movie.regen_cover":"Cover neu generieren",
    "game.search":"Spiele suchen...","game.add_failed":"Spiel hinzufügen fehlgeschlagen","game.scan_steam":"Steam-Spiele scannen","game.close":"Schließen",
    "image.search":"Bilder suchen...","image.exit_fullscreen":"Vollbild verlassen / Esc","image.tauri_only":"Bitte Tauri-Desktop-Umgebung verwenden","image.select_folder":"Ordner zum Import auswählen","image.set_wallpaper":"Als Hintergrund","image.unit":"Bild",
    "music.select_folder":"Ordner zum Import auswählen","music.unit":"Titel",
    "batch.selected_count":"{{n}} ausgewählt","batch.select_all":"Alle auswählen","batch.invert":"Umkehren","batch.batch_tags":"Stapel-Tags","batch.batch_delete":"Stapel löschen","batch.cancel":"Abbrechen","batch.items_suffix":" Elemente",
    "mediaScan.no_new_media":"Keine neuen Medien gefunden (Bereits importierte übersprungen)","mediaScan.imported_n":"{{n}} {{unit}} importiert","mediaScan.truncated":" (2000-Limit erreicht; erneut importieren für mehr)",
    "bgTuner.title":"Hintergrundvideo-Tuner","bgTuner.reset_default":"Standard wiederherstellen","bgTuner.playback_rate":"Abspielrate","bgTuner.first_start":"Erster Start","bgTuner.first_start_hint":"0=von Anfang","bgTuner.first_end":"Erstes Ende","bgTuner.first_end_hint":"0=bis Ende","bgTuner.loop_start":"Schleifenstart","bgTuner.loop_start_hint":"Schleifenstartposition (Sek)","bgTuner.loop_duration":"Schleifendauer","bgTuner.loop_duration_hint":"Schleifenabspieldauer (Sek)","bgTuner.transition":"Übergang","bgTuner.transition_hint":"Cross-Fade zwischen Segmenten","bgTuner.loop_count":"Schleifenzahl","bgTuner.loop_count_hint":"0=unendlich","bgTuner.loop_count_unit":"×",
    "privacy.title":"Helfen Sie uns, besser zu werden","privacy.description":"Wir möchten anonyme Nutzungsdaten sammeln, um die App zu verbessern. Diese Daten umfassen nur:","privacy.item_themes":"Verwendete Themen und Wechselhäufigkeit","privacy.item_usage":"Nutzungsstatistiken der Funktionen","privacy.item_crash":"App-Abstürze und Fehlerberichte","privacy.disclaimer":"Wir sammeln keine persönlichen Daten, Dateiinhalte oder Wiedergabeverläufe. Alle Daten sind vollständig anonymisiert und dienen nur der Produktverbesserung. Sie können dies jederzeit in den Einstellungen ändern.","privacy.agree":"Zustimmen","privacy.decline":"Ablehnen",
    "updateChecker.new_version":"Update verfügbar","updateChecker.update_now":"Jetzt aktualisieren","updateChecker.downloading":"Wird heruntergeladen...","updateChecker.manual_download":"Manueller Download · GitHub",
    "common.set_wallpaper":"Als Hintergrund","common.tauri_only":"Bitte Tauri-Desktop-Umgebung verwenden","common.dont_ask_again":"Nicht mehr fragen","common.player_bg_color":"Player-Hintergrundfarbe","common.player_bg_disabled_hint":"Aktivieren Sie Benutzerdefiniert in Einstellungen → Musik → Player-Hintergrund","common.clear":"Löschen","common.opacity":"Transparenz",
  },
  fr: {
    "movie.processing":"Traitement...","movie.unit":"film","movie.set_wallpaper":"Définir comme fond","movie.resume_text":"Repris à {{min}}:{{sec}} · Cliquer pour reprendre du début","movie.watched":"Vu","movie.external_player":"Externe","movie.need_external_player":"Lecteur externe requis","movie.regen_cover":"Régénérer la couverture",
    "game.search":"Rechercher des jeux...","game.add_failed":"Échec de l'ajout du jeu","game.scan_steam":"Analyser les jeux Steam","game.close":"Fermer",
    "image.search":"Rechercher des images...","image.exit_fullscreen":"Quitter plein écran / Échap","image.tauri_only":"Veuillez utiliser l'environnement de bureau Tauri","image.select_folder":"Sélectionner un dossier à importer","image.set_wallpaper":"Définir comme fond","image.unit":"image",
    "music.select_folder":"Sélectionner un dossier à importer","music.unit":"morceau",
    "batch.selected_count":"{{n}} sélectionnés","batch.select_all":"Tout sélectionner","batch.invert":"Inverser","batch.batch_tags":"Tags groupés","batch.batch_delete":"Suppression groupée","batch.cancel":"Annuler","batch.items_suffix":" éléments",
    "mediaScan.no_new_media":"Aucun nouveau média trouvé (déjà importés ignorés)","mediaScan.imported_n":"{{n}} {{unit}} importés","mediaScan.truncated":" (Limite de 2000 atteinte ; réimportez pour plus)",
    "bgTuner.title":"Réglage vidéo d'arrière-plan","bgTuner.reset_default":"Réinitialiser","bgTuner.playback_rate":"Vitesse de lecture","bgTuner.first_start":"Premier démarrage","bgTuner.first_start_hint":"0=depuis le début","bgTuner.first_end":"Première fin","bgTuner.first_end_hint":"0=jusqu'à la fin","bgTuner.loop_start":"Début de boucle","bgTuner.loop_start_hint":"Position de début de boucle (s)","bgTuner.loop_duration":"Durée de boucle","bgTuner.loop_duration_hint":"Durée de lecture en boucle (s)","bgTuner.transition":"Transition","bgTuner.transition_hint":"Fondu enchaîné entre segments","bgTuner.loop_count":"Nombre de boucles","bgTuner.loop_count_hint":"0=infini","bgTuner.loop_count_unit":"×",
    "privacy.title":"Aidez-nous à nous améliorer","privacy.description":"Nous souhaitons collecter des données d'utilisation anonymes pour améliorer l'application. Ces données incluent uniquement :","privacy.item_themes":"Thèmes utilisés et fréquence de changement","privacy.item_usage":"Statistiques d'utilisation des fonctionnalités","privacy.item_crash":"Rapports de plantage et d'erreur","privacy.disclaimer":"Nous ne collectons aucune information personnelle, contenu de fichier ou historique de lecture. Toutes les données sont entièrement anonymisées et servent uniquement à l'amélioration du produit. Vous pouvez modifier ce paramètre à tout moment.","privacy.agree":"Accepter","privacy.decline":"Refuser",
    "updateChecker.new_version":"Mise à jour disponible","updateChecker.update_now":"Mettre à jour","updateChecker.downloading":"Téléchargement...","updateChecker.manual_download":"Téléchargement manuel · GitHub",
    "common.set_wallpaper":"Définir comme fond","common.tauri_only":"Veuillez utiliser l'environnement de bureau Tauri","common.dont_ask_again":"Ne plus demander","common.player_bg_color":"Couleur de fond du lecteur","common.player_bg_disabled_hint":"Activez Personnalisé dans Paramètres → Musique → Fond du lecteur","common.clear":"Effacer","common.opacity":"Opacité",
  },
  it: {
    "movie.processing":"Elaborazione...","movie.unit":"film","movie.set_wallpaper":"Imposta come sfondo","movie.resume_text":"Ripreso da {{min}}:{{sec}} · Clicca per ricominciare","movie.watched":"Visto","movie.external_player":"Esterno","movie.need_external_player":"Lettore esterno necessario","movie.regen_cover":"Rigenera copertina",
    "game.search":"Cerca giochi...","game.add_failed":"Aggiunta gioco fallita","game.scan_steam":"Scansiona giochi Steam","game.close":"Chiudi",
    "image.search":"Cerca immagini...","image.exit_fullscreen":"Esci da schermo intero / Esc","image.tauri_only":"Usa l'ambiente desktop Tauri","image.select_folder":"Seleziona cartella da importare","image.set_wallpaper":"Imposta come sfondo","image.unit":"immagine",
    "music.select_folder":"Seleziona cartella da importare","music.unit":"brano",
    "batch.selected_count":"{{n}} selezionati","batch.select_all":"Seleziona tutto","batch.invert":"Inverti","batch.batch_tags":"Tag in blocco","batch.batch_delete":"Elimina in blocco","batch.cancel":"Annulla","batch.items_suffix":" elementi",
    "mediaScan.no_new_media":"Nessun nuovo media trovato (già importati saltati)","mediaScan.imported_n":"Importati {{n}} {{unit}}","mediaScan.truncated":" (Limite 2000 raggiunto; importa di nuovo per altri)",
    "bgTuner.title":"Sintonizzatore video di sfondo","bgTuner.reset_default":"Ripristina predefiniti","bgTuner.playback_rate":"Velocità riproduzione","bgTuner.first_start":"Primo avvio","bgTuner.first_start_hint":"0=dall'inizio","bgTuner.first_end":"Prima fine","bgTuner.first_end_hint":"0=fino alla fine","bgTuner.loop_start":"Inizio ciclo","bgTuner.loop_start_hint":"Posizione inizio ciclo (s)","bgTuner.loop_duration":"Durata ciclo","bgTuner.loop_duration_hint":"Durata riproduzione ciclo (s)","bgTuner.transition":"Transizione","bgTuner.transition_hint":"Dissolvenza incrociata tra segmenti","bgTuner.loop_count":"Numero cicli","bgTuner.loop_count_hint":"0=infinito","bgTuner.loop_count_unit":"×",
    "privacy.title":"Aiutaci a migliorare","privacy.description":"Vorremmo raccogliere dati di utilizzo anonimi per migliorare l'app. Questi dati includono solo:","privacy.item_themes":"Temi utilizzati e frequenza di cambio","privacy.item_usage":"Statistiche di utilizzo delle funzionalità","privacy.item_crash":"Segnalazioni di crash ed errori","privacy.disclaimer":"Non raccogliamo informazioni personali, contenuti di file o cronologia di riproduzione. Tutti i dati sono completamente anonimi e utilizzati solo per il miglioramento del prodotto. Puoi modificare questa opzione in qualsiasi momento nelle Impostazioni.","privacy.agree":"Accetta","privacy.decline":"Rifiuta",
    "updateChecker.new_version":"Aggiornamento disponibile","updateChecker.update_now":"Aggiorna ora","updateChecker.downloading":"Download in corso...","updateChecker.manual_download":"Download manuale · GitHub",
    "common.set_wallpaper":"Imposta come sfondo","common.tauri_only":"Usa l'ambiente desktop Tauri","common.dont_ask_again":"Non chiedere più","common.player_bg_color":"Colore sfondo lettore","common.player_bg_disabled_hint":"Attiva Personalizzato in Impostazioni → Musica → Sfondo lettore","common.clear":"Cancella","common.opacity":"Opacità",
  },
};

// Merge translations into each locale file
for (const lang of ['ja','ko','de','fr','it']) {
  const data = JSON.parse(fs.readFileSync(`src/i18n/locales/${lang}.json`, 'utf8'));
  for (const [keyPath, value] of Object.entries(trans[lang])) {
    const parts = keyPath.split('.');
    let obj = data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!obj[parts[i]]) obj[parts[i]] = {};
      obj = obj[parts[i]];
    }
    obj[parts[parts.length - 1]] = value;
  }
  fs.writeFileSync(`src/i18n/locales/${lang}.json`, JSON.stringify(data, null, 2) + '\n');
  console.log(`${lang}.json updated`);
}

console.log('\nDone! All locale files updated.');
