/**
 * Beginner curriculum (Traditional Chinese copy; notation stays Latin).
 * white-on-U layer-by-layer path + optional CFOP intro.
 */
(function (root) {
  "use strict";

  /** @typedef {{ id: string, title: string, blurb: string, kind: string, goal?: string, body: string, algorithm?: string, setup?: string, hintMoves?: string[], tryMoves?: string[], sheet?: {name: string, alg: string, note: string}[] }} Lesson */

  /** @type {Lesson[]} */
  const LESSONS = [
    {
      id: "basics-pieces",
      title: "認識三類方塊",
      blurb: "中心、邊緣、角落各有什麼角色？",
      kind: "concept",
      body:
        "三階魔術方塊由 26 個小塊組成（沒有最中心的那顆）。\n\n" +
        "• 中心塊（Center）：每面 1 顆，顏色固定，決定該面最終顏色。\n" +
        "• 邊緣塊（Edge）：12 顆，各有 2 色。\n" +
        "• 角落塊（Corner）：8 顆，各有 3 色。\n\n" +
        "解方塊時，中心塊幾乎不當「要搬的目標」——你是把邊緣與角落搬到正確中心旁邊。",
    },
    {
      id: "basics-colors",
      title: "顏色與對面",
      blurb: "記住標準配色，之後看圖才不會暈",
      kind: "concept",
      body:
        "本站採用常見配色（與引擎一致）：\n\n" +
        "• U 上層＝白（White）\n" +
        "• D 下層＝黃（Yellow）\n" +
        "• F 前面＝綠（Green）\n" +
        "• B 後面＝藍（Blue）\n" +
        "• R 右面＝紅（Red）\n" +
        "• L 左面＝橙（Orange）\n\n" +
        "口訣：白對黃、綠對藍、紅對橙。拿實體方塊時，先確認中心顏色是否符合此相對關係。",
    },
    {
      id: "notation-faces",
      title: "轉面記號（Notation）",
      blurb: "U D L R F B 與 ' 、2",
      kind: "notation",
      algorithm: "R U R' U'",
      body:
        "每個字母代表「面向你時」順時針轉該面 90°：\n\n" +
        "• R＝右面、L＝左面、U＝上面、D＝下面、F＝前面、B＝後面\n" +
        "• 加 '（prime）＝逆時針，例如 R'\n" +
        "• 加 2＝轉 180°，例如 U2\n\n" +
        "下面會自動播放經典的「性感公式」R U R' U'。看著方塊理解方向，再自己按按鈕練習。",
      tryMoves: ["R", "U", "R'", "U'"],
    },
    {
      id: "notation-practice",
      title: "記號小測驗",
      blurb: "依提示執行指定步數",
      kind: "notation-quiz",
      body:
        "請依序按下：F → R → U → R' → F'\n\n" +
        "做對後會標示完成。若轉錯可用「復原」重來。記住：所有公式都用空白分隔，例如 R U R' U'。",
      tryMoves: ["F", "R", "U", "R'", "F'"],
    },
    {
      id: "white-cross",
      title: "白色十字",
      blurb: "先把白邊對齊中心",
      kind: "stage",
      goal: "white-cross",
      setup: "R U R' F R F' U F R' F' R",
      algorithm: "F R U R' U' F'",
      hintMoves: ["F", "R", "U", "R'", "U'", "F'"],
      body:
        "目標：上面（白心）出現白色十字，且四條白邊旁的側色與側心一致。\n\n" +
        "新手建議：先把四顆白邊「對準」白心成十字，再轉 U 對齊側色；不必背長公式。\n" +
        "練習關卡已打亂成「只差十字／白層」的狀態，完成十字即可過關。",
    },
    {
      id: "white-corners",
      title: "白色四角",
      blurb: "完成整個白面（第一層）",
      kind: "stage",
      goal: "white-corners",
      setup: "R U R' U' R U R' U' R U R'",
      algorithm: "R U R' U'",
      hintMoves: ["R", "U", "R'", "U'"],
      body:
        "目標：白面九格全白，且側面頂列顏色與該面中心一致（完整第一層）。\n\n" +
        "常用思路：把白角放到下層，用 R U R' U'（或鏡像）把角「鉤」上去。重複直到四角皆正確。",
    },
    {
      id: "second-layer",
      title: "第二層邊緣",
      blurb: "中層四邊歸位",
      kind: "stage",
      goal: "second-layer",
      setup: "U R U' R' U' F' U F",
      algorithm: "U R U' R' U' F' U F",
      hintMoves: ["U", "R", "U'", "R'", "U'", "F'", "U", "F"],
      body:
        "目標：中層四顆邊緣就位（白層已完成）。\n\n" +
        "右插公式：U R U' R' U' F' U F\n" +
        "左插公式：U' L' U L U F U' F'\n\n" +
        "先把目標邊緣轉到上面，對準前面顏色，再決定左插或右插。",
      sheet: [
        { name: "右插", alg: "U R U' R' U' F' U F", note: "邊緣要往右前方插入" },
        { name: "左插", alg: "U' L' U L U F U' F'", note: "邊緣要往左前方插入" },
      ],
    },
    {
      id: "yellow-cross",
      title: "黃色十字",
      blurb: "底面先做出黃十字",
      kind: "stage",
      goal: "yellow-cross",
      setup: "F R U R' U' F'",
      algorithm: "F R U R' U' F'",
      hintMoves: ["F", "R", "U", "R'", "U'", "F'"],
      body:
        "白層與中層完成後，翻看黃面（D）。目標是黃面邊緣呈十字（角可以還是別的顏色）。\n\n" +
        "公式：F R U R' U' F'\n" +
        "依點狀／拐杖／一橫線調整朝向後重複此公式。",
    },
    {
      id: "yellow-orient",
      title: "黃面朝向（OLL）",
      blurb: "讓整個黃面都是黃",
      kind: "stage",
      goal: "yellow-orient",
      setup: "R U R' U R U2 R'",
      algorithm: "R U R' U R U2 R'",
      hintMoves: ["R", "U", "R'", "U", "R", "U2", "R'"],
      body:
        "目標：黃面九格全黃（角落可能尚未「對邊」）。\n\n" +
        "新手常用「魚形」公式（Sune）：R U R' U R U2 R'\n" +
        "對準魚頭方向後執行，通常 1～3 次可讓黃面全黃。",
      sheet: [
        { name: "Sune（魚）", alg: "R U R' U R U2 R'", note: "最常用的黃角朝向公式" },
        { name: "反 Sune", alg: "R U2 R' U' R U' R'", note: "鏡像情況" },
      ],
    },
    {
      id: "permute-corners",
      title: "排列黃角",
      blurb: "角落位置正確",
      kind: "stage",
      goal: "permute-corners",
      setup: "U R U' L' U R' U' L",
      algorithm: "U R U' L' U R' U' L",
      hintMoves: ["U", "R", "U'", "L'", "U", "R'", "U'", "L"],
      body:
        "目標：黃角不僅朝上，側面顏色也與相鄰中心一致。\n\n" +
        "公式：U R U' L' U R' U' L\n" +
        "先找「已正確的一組角」放在後方，再執行；必要時重複。",
    },
    {
      id: "permute-edges",
      title: "排列黃邊",
      blurb: "最後一步，整顆還原！",
      kind: "stage",
      goal: "permute-edges",
      setup: "R2 U R U R' U' R' U' R' U R'",
      algorithm: "R2 U R U R' U' R' U' R' U R'",
      hintMoves: ["R2", "U", "R", "U", "R'", "U'", "R'", "U'", "R'", "U", "R'"],
      body:
        "目標：黃面邊緣也排到正確位置 → 整顆方塊還原。\n\n" +
        "U-perm（一種）：R2 U R U R' U' R' U' R' U R'\n" +
        "把已正確的一邊放在後方，再執行公式。",
    },
    {
      id: "cfop-intro",
      title: "進階：CFOP／四步預覽（選修）",
      blurb: "Cross → F2L → OLL → PLL",
      kind: "optional",
      body:
        "當層層法練熟後，可認識速度流 CFOP：\n\n" +
        "1. Cross：十字（常做在底面以利觀察）\n" +
        "2. F2L：一次插入「角＋邊」配對，取代分開做白角與中層\n" +
        "3. OLL：一次讓黃面全黃（57 種，新手可先學 2-look）\n" +
        "4. PLL：一次排好頂層（21 種，新手可先學 2-look）\n\n" +
        "本課程的層層法其實就是「簡化版 2-look OLL／PLL」。選修關卡無需過關檢測，閱讀即可標記完成。",
    },
  ];

  const CHEAT_SHEET = [
    { group: "中層", name: "右插", alg: "U R U' R' U' F' U F", note: "第二層往右" },
    { group: "中層", name: "左插", alg: "U' L' U L U F U' F'", note: "第二層往左" },
    { group: "黃十字", name: "FRUR'U'F'", alg: "F R U R' U' F'", note: "點／線／拐杖" },
    { group: "OLL", name: "Sune", alg: "R U R' U R U2 R'", note: "黃角朝向" },
    { group: "OLL", name: "Anti-Sune", alg: "R U2 R' U' R U' R'", note: "黃角朝向" },
    { group: "PLL", name: "角交換", alg: "U R U' L' U R' U' L", note: "排列黃角" },
    { group: "PLL", name: "U-perm", alg: "R2 U R U R' U' R' U' R' U R'", note: "排列黃邊" },
    { group: "通用", name: "性感公式", alg: "R U R' U'", note: "插入／調整常用" },
  ];

  function lessonById(id) {
    return LESSONS.find((l) => l.id === id) || null;
  }

  function nextLessonId(id) {
    const i = LESSONS.findIndex((l) => l.id === id);
    if (i < 0 || i >= LESSONS.length - 1) return null;
    return LESSONS[i + 1].id;
  }

  root.CubeCurriculum = { LESSONS, CHEAT_SHEET, lessonById, nextLessonId };
})(typeof globalThis !== "undefined" ? globalThis : window);
