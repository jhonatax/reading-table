/* The Reading Table — content data.
   Edit this file to add/remove books or change the quiz. No build step needed.
   Book fields: pace/tone/challenge are 1-5; length: short|medium|long; format: fiction|nonfiction;
   content tags must match the dealbreaker option ids in QUESTIONS. */
(function(){
  /* ---------------------------------------------------------------
     DATA: the shelf
  --------------------------------------------------------------- */
  var BOOKS = [
    {t:"The Kite Runner", a:"Khaled Hosseini", genres:["literary"], culture:"Middle East/Central Asia", pace:3, tone:4, challenge:3, length:"long", format:"fiction", content:["violence","emotionally-heavy"]},
    {t:"Pachinko", a:"Min Jin Lee", genres:["literary","history"], culture:"Asia", pace:2, tone:3, challenge:3, length:"long", format:"fiction", content:["emotionally-heavy"]},
    {t:"Circe", a:"Madeline Miller", genres:["scifi-fantasy"], culture:"Europe", pace:3, tone:3, challenge:2, length:"medium", format:"fiction", content:[]},
    {t:"Project Hail Mary", a:"Andy Weir", genres:["scifi-fantasy"], culture:"US/UK", pace:5, tone:2, challenge:2, length:"long", format:"fiction", content:[]},
    {t:"The Seven Husbands of Evelyn Hugo", a:"Taylor Jenkins Reid", genres:["romance"], culture:"US/UK", pace:4, tone:3, challenge:1, length:"medium", format:"fiction", content:[]},
    {t:"Educated", a:"Tara Westover", genres:["nonfiction","history"], culture:"US/UK", pace:3, tone:4, challenge:3, length:"medium", format:"nonfiction", content:["emotionally-heavy"]},
    {t:"Sapiens", a:"Yuval Noah Harari", genres:["nonfiction","history"], culture:"Global", pace:2, tone:2, challenge:4, length:"long", format:"nonfiction", content:["dense-prose"]},
    {t:"One Hundred Years of Solitude", a:"Gabriel García Márquez", genres:["literary"], culture:"Latin America", pace:1, tone:3, challenge:5, length:"long", format:"fiction", content:["dense-prose","slow-pacing"]},
    {t:"Homegoing", a:"Yaa Gyasi", genres:["literary","history"], culture:"Africa", pace:2, tone:4, challenge:3, length:"medium", format:"fiction", content:["violence","emotionally-heavy"]},
    {t:"The Housemaid", a:"Freida McFadden", genres:["mystery-thriller"], culture:"US/UK", pace:5, tone:4, challenge:1, length:"short", format:"fiction", content:["violence","graphic-content"]},
    {t:"Where the Crawdads Sing", a:"Delia Owens", genres:["literary","mystery-thriller"], culture:"US/UK", pace:3, tone:3, challenge:2, length:"medium", format:"fiction", content:[]},
    {t:"The Midnight Library", a:"Matt Haig", genres:["scifi-fantasy"], culture:"Europe", pace:3, tone:3, challenge:2, length:"short", format:"fiction", content:["sentimental"]},
    {t:"Klara and the Sun", a:"Kazuo Ishiguro", genres:["literary","scifi-fantasy"], culture:"Asia", pace:2, tone:3, challenge:4, length:"medium", format:"fiction", content:[]},
    {t:"The Silent Patient", a:"Alex Michaelides", genres:["mystery-thriller"], culture:"Europe", pace:5, tone:5, challenge:2, length:"medium", format:"fiction", content:["violence"]},
    {t:"Convenience Store Woman", a:"Sayaka Murata", genres:["literary"], culture:"Asia", pace:3, tone:2, challenge:2, length:"short", format:"fiction", content:[]},
    {t:"The Overstory", a:"Richard Powers", genres:["literary"], culture:"US/UK", pace:1, tone:3, challenge:5, length:"long", format:"fiction", content:["dense-prose","slow-pacing"]},
    {t:"Beloved", a:"Toni Morrison", genres:["literary","history"], culture:"US/UK", pace:1, tone:5, challenge:5, length:"medium", format:"fiction", content:["violence","dense-prose","emotionally-heavy"]},
    {t:"The Alchemist", a:"Paulo Coelho", genres:["literary"], culture:"Latin America", pace:3, tone:2, challenge:1, length:"short", format:"fiction", content:["sentimental"]},
    {t:"Braiding Sweetgrass", a:"Robin Wall Kimmerer", genres:["nonfiction"], culture:"Global", pace:1, tone:2, challenge:3, length:"long", format:"nonfiction", content:["slow-pacing"]},
    {t:"Gone Girl", a:"Gillian Flynn", genres:["mystery-thriller"], culture:"US/UK", pace:5, tone:5, challenge:2, length:"medium", format:"fiction", content:["violence","graphic-content"]},
    {t:"A Man Called Ove", a:"Fredrik Backman", genres:["literary"], culture:"Europe", pace:2, tone:2, challenge:1, length:"medium", format:"fiction", content:["sentimental"]},
    {t:"The Nickel Boys", a:"Colson Whitehead", genres:["literary","history"], culture:"US/UK", pace:2, tone:5, challenge:4, length:"short", format:"fiction", content:["violence","emotionally-heavy"]},
    {t:"Crying in H Mart", a:"Michelle Zauner", genres:["nonfiction"], culture:"Asia", pace:3, tone:4, challenge:2, length:"medium", format:"nonfiction", content:["emotionally-heavy"]},
    {t:"The Three-Body Problem", a:"Liu Cixin", genres:["scifi-fantasy"], culture:"Asia", pace:3, tone:3, challenge:4, length:"long", format:"fiction", content:[]},
    {t:"Tomorrow, and Tomorrow, and Tomorrow", a:"Gabrielle Zevin", genres:["literary"], culture:"US/UK", pace:3, tone:3, challenge:2, length:"medium", format:"fiction", content:[]},
    {t:"Lessons in Chemistry", a:"Bonnie Garmus", genres:["literary","history"], culture:"US/UK", pace:4, tone:3, challenge:1, length:"medium", format:"fiction", content:[]}
  ];

  var GENRE_LABELS = {
    "literary":"Literary fiction","mystery-thriller":"Mystery / thriller","scifi-fantasy":"Sci-fi / fantasy",
    "nonfiction":"Nonfiction","romance":"Romance","history":"History"
  };

  /* ---------------------------------------------------------------
     QUESTIONS
  --------------------------------------------------------------- */
  var QUESTIONS = [
    {
      id:"genres", type:"multi", q:"Which shelves do you keep returning to?",
      sub:"Pick as many as fit.",
      options:[
        ["literary","Literary fiction"],["mystery-thriller","Mystery / thriller"],
        ["scifi-fantasy","Sci-fi / fantasy"],["nonfiction","Nonfiction"],
        ["romance","Romance"],["history","History"]
      ]
    },
    {
      id:"pace", type:"single", q:"How do you like a book to move?",
      options:[
        ["5","Fast — I want to keep turning pages"],
        ["3","A good mix of fast and slow"],
        ["1","Slow and immersive, prose I can sit in"]
      ]
    },
    {
      id:"length", type:"multi", q:"What lengths are you actually going to finish?",
      sub:"Be honest — pick all that apply.",
      options:[
        ["short","Short (under ~250 pages)"],
        ["medium","Medium (~250–400 pages)"],
        ["long","Long (400+ pages), if it's good"]
      ]
    },
    {
      id:"tone", type:"single", q:"What tone are you in the mood for, generally?",
      options:[
        ["1","Light and hopeful"],
        ["3","Somewhere in between"],
        ["5","Dark and intense, don't hold back"]
      ]
    },
    {
      id:"want", type:"single", q:"When a book lands in your hands, what do you want it to do first?",
      options:[
        ["fast","Pull me in fast"],
        ["think","Make me think"],
        ["feel","Make me feel something"],
        ["teach","Teach me something true"]
      ]
    },
    {
      id:"challenge", type:"single", q:"Comfort read, or a stretch?",
      options:[
        ["1","Give me something easy to fall into"],
        ["3","A bit of both is fine"],
        ["5","I like being challenged by the prose or ideas"]
      ]
    },
    {
      id:"culture", type:"single", q:"Whose stories are you most curious about right now?",
      options:[
        ["different","Places and cultures unlike my own"],
        ["nopref","No strong preference, whatever's good"],
        ["familiar","Settings that feel close to home"]
      ]
    },
    {
      id:"format", type:"single", q:"Fiction or nonfiction?",
      options:[
        ["fiction","Fiction, mostly"],
        ["either","Either, depending on the book"],
        ["nonfiction","Nonfiction, mostly"]
      ]
    },
    {
      id:"dealbreakers", type:"multi", q:"Anything you'd rather the group skip?",
      sub:"Optional — pick any that are hard nos for you.",
      options:[
        ["violence","Graphic violence"],
        ["graphic-content","Very graphic/disturbing content"],
        ["dense-prose","Dense, difficult prose"],
        ["slow-pacing","Very slow pacing"],
        ["sentimental","Sentimental / twee"]
      ]
    }
  ];

  window.RT_DATA = { BOOKS: BOOKS, GENRE_LABELS: GENRE_LABELS, QUESTIONS: QUESTIONS };
})();
