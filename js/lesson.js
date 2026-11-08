/* Lesson 1 only — absolute A1, introductions. Not a full course. */
(function () {
  const Z = "\u200c";
  const E = "\u0654";

  const sentences = [
    {
      sentence: "Ik heet Sara.",
      meaning: "اسم من سارا است.",
      notes: [
        "بشمار: {Ik} واژه" + E + " اول است و {heet} واژه" + E + " دوم. در جمله" + E + " خبری فعل جایگاه دوم را دارد؛ این قانون {V2} است.",
        "{heten} با {ik} می" + Z + "شود {heet}.",
        "اسم شخص {de} یا {het} نمی" + Z + "گیرد.",
      ],
    },
    {
      sentence: "Ik ben student.",
      meaning: "من دانشجو هستم.",
      notes: [
        "{zijn} با {ik} بی" + Z + "قاعده است و می" + Z + "شود {ben}.",
        "{student} اسم است و جنس آن {de} است: {de student}.",
        "برای گفتن شغل، معمولاً {de} را برمی" + Z + "داریم: {Ik ben student}.",
      ],
    },
    {
      sentence: "Ik woon in Amsterdam.",
      meaning: "من در آمستردام زندگی می" + Z + "کنم.",
      notes: [
        "الگوی بیشتر فعل" + Z + "ها با {ik}: از مصدر، {-en} را بردار. {wonen} می" + Z + "شود {woon}.",
        "فعل باز هم واژه" + E + " دوم است: {Ik woon}.",
        "بعد از {in}، نام شهر بدون حرف تعریف می" + Z + "آید و با حرف بزرگ نوشته می" + Z + "شود: {Amsterdam}.",
      ],
    },
    {
      sentence: "Ik kom uit Iran.",
      meaning: "من از ایران می" + Z + "آیم.",
      notes: [
        "همان الگو: {komen} با {ik} می" + Z + "شود {kom}.",
        "{uit} یعنی «از» و برای کشور مبدأ است: {uit Iran}.",
        "{Iran} در این جمله {de} یا {het} نمی" + Z + "گیرد.",
      ],
    },
    {
      sentence: "Ik spreek een beetje Nederlands.",
      meaning: "من کمی هلندی حرف می" + Z + "زنم.",
      notes: [
        "{spreken} با {ik} می" + Z + "شود {spreek}.",
        "{beetje} اسم است و جنس آن {het} است: {het beetje}. {een beetje} یعنی «کمی».",
        "نام زبان را با حرف بزرگ می" + Z + "نویسیم. این" + Z + "جا {Nederlands} بدون {de} و {het} آمده است.",
      ],
    },
    {
      sentence: "Hoe heet je?",
      meaning: "اسم تو چیست؟",
      notes: [
        "{Hoe heet je?} یعنی «اسم تو چیست؟». {hoe} این" + Z + "جا برای پرسیدن اسم است.",
        "در سؤال، فعل قبل از فاعل می" + Z + "آید: {heet} پیش از {je}.",
        "{je} یعنی «تو». {heten} با {je} هم {heet} می" + Z + "ماند.",
      ],
    },
    {
      sentence: "Waar woon je?",
      meaning: "کجا زندگی می" + Z + "کنی؟",
      notes: [
        "{waar} یعنی «کجا».",
        "باز هم فعل قبل از فاعل است: {Waar woon je?}",
        "چون {je} بعد از فعل آمده، {wonen} می" + Z + "شود {woon}، نه {woont}.",
      ],
    },
    {
      sentence: "Ik drink koffie.",
      meaning: "من قهوه می" + Z + "نوشم.",
      notes: [
        "{drinken} با {ik} می" + Z + "شود {drink}.",
        "{koffie} اسم است و جنس آن {de} است: {de koffie}.",
        "وقتی از قهوه به" + Z + "طور کلی حرف می" + Z + "زنیم، {de} را برمی" + Z + "داریم: {Ik drink koffie}.",
      ],
    },
  ];

  sentences.forEach((item) => {
    item.words = item.sentence.replace(/[.?!]$/, "").split(/\s+/);
  });

  window.DUTCH_LESSON = {
    id: 1,
    level: "A1",
    titleFa: "معرفی خودت",
    sentences,
  };
})();
