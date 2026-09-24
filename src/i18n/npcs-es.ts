import type { ContentTable } from "./content";

/**
 * Diálogos en español. Mismos ids y misma forma que data/npcs.ts, pero
 * escritos para que suenen a gente de aquí: cada uno con su voz.
 * Marcadores: {player} {deaths} {lost} {won} {stolen} {floor}.
 */
export const ES_NPCS: ContentTable["npcs"] = {
  mira: {
    name: "Mira la tendera",
    talk: [
      ["Madera, piedra, mineral, hierbas… te lo compro todo.", "Y gemas, sobre todo. Un buen rubí te paga la cerveza de un mes."],
      ["Cuanto más hondo el mineral, mejor se paga. Plata, oro… mithril, si tienes lo que hay que tener."],
      ["¿Pergaminos de regreso? Se hacen en el banco de la fragua. Tablones y una raíz sanadora. Valen cada moneda."],
      ["Aquí no compro nada que siga calentito del bolsillo de otro. Norma de la casa."],
    ],
    lines: {
      honorHigh: ["¡Justo a quien esperaba! Te he rebajado un poquito, pero calladito, ¿eh?"],
      honorLow: ["Las manos donde yo las vea, por favor. Sí, las dos. Gracias."],
      "event:festival": ["¡Día de fiesta! Todo el mundo vende y nadie regatea. Me encanta."],
      "event:merchant": ["Ha llegado un mercader ambulante a la plaza. Unos precios que deberían ser ilegales. Los míos, digo. Los suyos son directamente delito."],
    },
  },
  bram: {
    name: "Bram el herrero",
    talk: [
      ["Tráeme lingotes y te forjo algo que no se parta en la cabeza de un orco.", "¿Sin lingotes? Funde mineral con carbón en el horno de ahí detrás."],
      ["Un pico de hierro puede con el cobre y la plata. El de acero, con el oro. El mithril… eso ya es de leyenda."],
      ["Cada herramienta que hago te deja cavar más hondo. Cada hoja, pelear más hondo. Ese es todo el truco."],
      ["Ahora también hago yelmos y botas. La gente volvía con la cabeza abollada y los pies helados."],
    ],
    lines: {
      honorLow: ["Te vendo una espada. Lo que no tengo es por qué alegrarme."],
      hit: ["¿Me acabas de…? ¿En una HERRERÍA? Qué valor."],
    },
  },
  apprentice: {
    name: "El aprendiz de Dorrin",
    talk: [
      ["La Mina Vieja está abierta a cualquiera con un pico. Piedra, carbón y hierro arriba; cuanto más bajas, mejor se pone."],
      ["Dicen que la mina se recoloca cada vez que bajas. Así el mineral está siempre fresquito, supongo."],
    ],
  },
  tobin: {
    name: "El viejo Tobin",
    talk: [
      [
        "El Túmulo Viejo, sí. Los orcos cavaron desde abajo y se montaron ahí su guarida.",
        "Baja y baja sin parar. Cada cinco pisos hay algo gordo guardando el paso: túmbalo y la próxima vez recordarás el camino.",
        "Y si mueres ahí abajo… pierdes lo que hayas encontrado.",
      ],
      ["Si los bichos empiezan a pegar muy fuerte, vete a casa. Mejor acero, más brazo, y vuelta a empezar. Las Profundidades no se van a ir a ningún lado."],
      ["Entre tú y yo: la mitad de esos orcos fichan a la salida del sol. Los he visto en la taberna. Muy educados, oye."],
    ],
    night: [["¿Tú tampoco puedes dormir? El túmulo zumba por las noches. Huesos viejos, rencores viejos."]],
    lines: {
      "event:strike": ["¡Los orcos están de huelga, fíjate! Con piquete y todo. El primer piso nunca había sido tan educado."],
    },
  },
  finn: {
    name: "Finn el Turbio",
    talk: [
      ["Psst. El Bosque Susurrante, aquí al este, tiene todo lo que necesita un aventurero muerto de hambre. Los senderos cambian cada noche, ojo."],
      ["Al norte del bosque, la Espesura. Vetas de oro. Cristales de escarcha. Y tras las zarzas… algo más viejo. Llévate un hacha de acero."],
      ["Madame Vex tiene una rueda en la taberna. Colores muy bonitos. Muy caros también."],
      ["Las cosas se caen de los carros, ¿sabes? A veces yo pasaba por al lado del carro. No digo más."],
    ],
    lines: {
      returned: ["¿Que dónde estaba? Gansos. Muchos gansos. Tenían un barco.", "No preguntes. En serio. Los gansos podrían estar escuchando."],
      honorLow: ["Eso sí que es una reputación. Un día hablamos de negocios."],
      honorHigh: ["Uf. Una leyenda local. Baja la voz, que me estropeas la imagen."],
    },
  },
  watchman: {
    name: "El sereno",
    talk: [["Noche tranquila. Más o menos. La taberna sigue a tope si tienes monedas que perder."], ["Dicen que los pétalos lunares solo florecen de noche. Allá en el bosque."]],
    lines: {
      honorLow: ["Te tengo echado el ojo. Este. El otro es para la taberna."],
      honorHigh: ["Buenas noches. Tú duerme a pierna suelta, que aquí estamos nosotros."],
    },
  },
  hale: {
    name: "Hale el leñador",
    talk: [
      ["Madera rara, esta. Los senderos vuelven a crecer distintos cada noche: nunca es el mismo bosque dos veces.", "Robles para madera, pedruscos grises para piedra y hierbas en los claros. Los robles dorados piden hacha de hierro."],
      ["¿Ves un muro de zarzas en un sendero? Dale hachazos. La gente esconde los mejores sitios detrás."],
      ["Los ciervos se espantan si vas a saco. Ve despacio, o llévate un arco. Los jabalíes… los jabalíes te embisten de vuelta."],
    ],
  },
  dorrin: {
    name: "Dorrin el minero",
    talk: [
      ["¡Esto es la Mina Vieja! Los túneles cambian cada vez que bajas; no me preguntes cómo.", "La roca gris da piedra. Las vetas negras, carbón. Las manchas de óxido, hierro. Busca la escalera para bajar."],
      ["El cobre sale por el piso cinco, la plata por el diez y el oro pasado el quince. Te harán falta mejores picos."],
      ["Cuidado con los techos agrietados más abajo. Y cada cinco pisos hay parada de montacargas: la próxima vez bajas en él."],
    ],
  },
  hob: {
    name: "Hob el granjero",
    talk: [
      ["Los mejores nabos de tres valles, los míos. Cuarenta años de nabos.", "Y el peor jugador de blackjack de tres valles, también. Cuarenta años de eso."],
      ["El truco es pedir carta con veinte. Pillas a la banca por sorpresa. …A mí también me pilla por sorpresa, cada vez."],
      ["Mi cerda, la Duquesa, es más lista que yo. No juega. Ni siquiera mira la rueda."],
    ],
    lines: {
      "event:pig": ["¡DUQUESA! ¿Has visto a la Duquesa? ¿Rosa, lista, con cara de juzgarte? ¡Se ha vuelto a escapar!"],
      gossip: ["¿Conque has perdido {lost} de oro en las mesas? Ya eres del club. Nos reunimos todas las noches."],
    },
  },
  greta: {
    name: "Greta la tabernera",
    talk: [
      ["¡Pasa, pasa, que esto es el Guiverno Achispado! El guiso quema y la cerveza está fresquita.", "Y si te sientes con suerte… Silas reparte blackjack arriba y Vex hace girar la rueda. Luego no digas que no te avisé."],
      ["La despensa está pasando la cocina. Sírvete de la caja de sobras: una vez al día, ¿eh?"],
      ["¿Ves a Morg, el de la chimenea? Orco. Trabaja en el Túmulo. Deja mejores propinas que cualquier humano de esta sala."],
    ],
    night: [["¡Menuda noche! Todo el mundo viene cuando oscurece. Los jugadores, los primeros."]],
    lines: {
      honorHigh: ["Para ti, cariño, la primera invita la casa."],
      honorLow: ["Primero se paga. Y las manos lejos de mi jarra, que las tengo contadas."],
      gossip: ["Dicen por ahí que has perdido {lost} de oro arriba. Silas lleva botas nuevas. ¿Casualidad?"],
      "event:brawl": ["Si vas a tirar una silla, tírala a la pared. A la PARED."],
      "event:festival": ["¡Precios de fiesta esta noche! Bueno. Casi de fiesta."],
    },
  },
  pip: {
    name: "Pip",
    talk: [
      ["Ojito en el Túmulo Viejo, cielo. Los orcos no dejan propina.", "Bueno, menos Morg."],
      ["¡Paso, paso! ¡Guiso caliente, cuidado con los codos!"],
      ["Aquí me entero de todo. De TODO. Pregúntame por el sereno y la cabra. Bueno, mejor no."],
    ],
    lines: {
      gossip: ["¿Has muerto {deaths} veces y sigues volviendo? O tienes mucho valor o muy poca cabeza, cielo. Me caes bien igual."],
    },
  },
  rowan: {
    name: "Sir Rowan",
    talk: [
      ["Yo limpié el Túmulo Viejo de joven. Grukk el Caudillo era un cachorro por aquel entonces.", "En el piso diez empieza la cripta. Los muertos de allí guardan tesoros más viejos."],
      ["¿Mi consejo? Armadura antes que espada. Los héroes muertos pegan muy fuerte durante unos tres segundos."],
      ["Un yelmo, hazme caso. Hazte con un yelmo. He visto lo que puede hacer un esqueleto con un fémur."],
    ],
    lines: {
      honorHigh: ["Ahí fuera hablan maravillas de ti. Te sienta bien. Que no se te suba a la cabeza: pesa más que un yelmo."],
    },
  },
  cook: {
    name: "El cocinero",
    talk: [["¡Fuera de mi cocina! …A no ser que traigas setas. Con brillasetas sale un guiso que da gloria."], ["¿Quieres recetas? Hazte con una cocina en condiciones. En una casa grande cabe una."], ["¿Venado? Tú tráeme un ciervo y te hago llorar. De lo bueno."]],
    lines: {
      honorLow: ["Alguien ha metido mano a mis tartas. Sé que has sido tú. Huelo la culpa. Huele a manzana."],
    },
  },
  silas: {
    name: "Silas el crupier",
    talk: [
      ["Te doy la bienvenida a la Timba Dorada. Aquí se juega al blackjack. Tú contra la casa.", "Acércate más a veintiuno que yo sin pasarte. Un blackjack de mano paga tres a dos. Yo me planto en diecisiete."],
      ["¿Otra vez por aquí? Las cartas se acuerdan de ti. Y la casa también."],
    ],
    lines: {
      gossip: ["{won} de oro ganado, {lost} perdido. La casa lleva muy bien las cuentas, ya ves."],
    },
  },
  vex: {
    name: "Madame Vex",
    talk: [
      ["La Rueda del Destino, cariño. Diecinueve casillas: nueve carmesí, nueve sombra… y el Dragón.", "Apuesta a un color, a par o impar, o a un número suelto si notas que los dioses te sonríen. El Dragón se lo come todo."],
      ["A la rueda le da igual quién seas. Eso es lo que más me gusta de ella."],
    ],
  },
  lyra: {
    name: "Lyra la juglaresa",
    talk: [
      ["♪ El rey orco perdió la corona, abajo, abajo, en el túmulo… ♪", "Las peticiones cuestan una moneda. Las quejas, dos."],
      ["♪ El minero buscaba plata y encontró un diente de dragón… ♪", "Está en proceso."],
      ["Toco todas las noches. Los de la rueda dejan más propina cuando van ganando."],
      ["Estoy componiendo una balada sobre ti. Va sobre todo de aquella vez que te caíste. Es muy emotiva."],
    ],
    lines: {
      honorHigh: ["♪ Y el héroe volvió y el pueblo aplaudió… ♪ Esa va por ti. Evidentemente."],
      honorLow: ["♪ Guarda tus tartas, guarda tu bolsa… ♪ Es solo una canción. Por nada."],
      gossip: ["¿{deaths} muertes? Eso da para un disco entero."],
    },
  },
  gambler_1: {
    name: "Jugador nervioso",
    talk: [["Una mano más. Y me voy a casa. Palabra."], ["Tenía un sistema. El sistema me tenía a mí."]],
  },
  gambler_2: {
    name: "Lou el Suertudo",
    talk: [["El truco está en saber cuándo levantarse de la mesa. Yo nunca lo he hecho, pero sé que ese es el truco."], ["La suerte se entrena, créeme. Abre cofres, encuentra cosas raras… algo se pega."]],
  },
  traveler_1: {
    name: "Viajero cansado",
    talk: [["He venido andando desde la costa. Me dijeron que vuestra mazmorra no tiene fondo. Ojalá me mintieran."], ["En la costa hay monstruos marinos. Aquí tenéis un orco que hace crucigramas. Yo me quedo."]],
  },
  traveler_2: {
    name: "Mercader de tierras lejanas",
    talk: [
      ["En la capital, el mithril se paga a precio de oro. Aquí, lo cavas tú mismo. Qué encanto."],
      ["Diecinueve casillas tiene esa rueda. El Dragón sale una de cada diecinueve: un cinco coma veintiséis por ciento.", "No soy jugador. Solo soy… muy leído. En ruedas. En esa en concreto."],
      ["Silas baraja cuando quedan veinte cartas. Cuatro mazos. No es que las haya contado. ¿Quién iba a contarlas?"],
    ],
  },
  patron_1: {
    name: "Parroquiano achispado",
    talk: [["*hip* ¿Has probado… el guiso? *hip* Yo tampoco."], ["Tienes una… *hip* …una cara. Enhorabuena."]],
  },
  patron_2: {
    name: "Guardia fuera de servicio",
    talk: [["No le digas al capitán que estoy aquí. Ni que he perdido las botas en la rueda."], ["Morg y yo hacemos el mismo trabajo, en el fondo. Él vigila cosas. Yo vigilo cosas. Solidaridad."]],
  },
  bouncer: {
    name: "El Bruto",
    talk: [["El reservado es para jugadores serios. Apuestas a nivel cinco, o de aquí no pasas."], ["…También pinto acuarelas. No se lo digas a nadie."]],
  },
  morg: {
    name: "Morg (fuera de servicio)",
    talk: [
      ["Buenas. Sí, soy un orco. Sí, del Túmulo. No, no estoy trabajando. Son más de las seis.", "Turnos de doce horas vigilando una escalera. ¿Y el seguro dental? No me tires de la lengua."],
      ["Espera… tú eres quien no para de bajar al piso tres. Por tu culpa Durg necesita un casco nuevo.", "Sin rencores. Es el curro. Invítame a una cerveza y en paz."],
      ["Mi madre quería que fuera herrero. Ahora me zurran los clientes de los herreros. Cosas de la vida."],
      ["Le estoy tejiendo una bufanda a Grukk. El jefe se queda frío. Mucho cuerpo, poca circulación."],
    ],
    night: [["Mañana tengo turno de tarde. Piso cinco. Si ves a un orco grandote con bufanda de punto, no te pases con él, ¿eh?"]],
    lines: {
      honorHigh: ["No estás mal, para ser de la superficie. No se lo digas a los colegas."],
      honorLow: ["Ni NOSOTROS le mangamos a Greta. Ni nosotros, ¿eh?"],
      gossip: ["¿{deaths} veces has caído en el Túmulo? Los colegas llevan la cuenta en la pared. Eres muy popular."],
      "event:strike": ["¡Estamos de huelga! ¡Mejores antorchas, turnos más cortos y ni un aventurero antes del desayuno!", "¡Solidaridad! …¿No te querrás afiliar, verdad?"],
      hit: ["EH. Aquí no. Aquí soy un CLIENTE."],
    },
  },
  rattles: {
    name: "Traquetes",
    talk: [
      ["¡Buenas noches! Tú ni caso. Vengo por el ambiente. No tengo pulmones, pero el ambiente me gusta."],
      ["Le pido carta a Silas y me dice que no tengo carne donde darme. Todas las noches. Todas las noches el mismo chiste."],
      ["Dicen que apostar es tirar el dinero. Yo no tengo nada que perder. Lo he comprobado. No me queda nada. Nada de nada."],
    ],
    lines: {
      gossip: ["¿Que has muerto {deaths} veces? Poca cosa. Yo llevo muerto trescientos años."],
      hit: ["¡Ay! Bueno. «Ay» no. Pero qué maleducado."],
    },
  },
  wick: {
    name: "El viejo Wick",
    talk: [
      ["¿Quieres un consejo? Claro que quieres. El truco de la minería… es chupar la roca. Si sabe a dinero, cava."],
      ["Nunca pelees con un esqueleto en martes. Los martes pegan más fuerte. O yo pego menos. Uno de los dos."],
      ["Plántate con doce. Siempre con doce. Así perdí la casa. Dos veces."],
      ["¿Las setas de la Espesura? Cómete las que brillan. Hazme caso. …Mejor no me hagas caso."],
    ],
  },
  hooded: {
    name: "Forastero encapuchado",
    talk: [
      ["Has muerto {deaths} veces, {player}. El Túmulo las recuerda todas."],
      ["Desde que llegaste han desaparecido {stolen} cosas. El pueblo lleva la cuenta. Y yo también."],
      ["La rueda tiene memoria. La baraja tiene memoria. Solo la gente olvida."],
    ],
    lines: {
      honorHigh: ["Qué luz tan brillante. Las polillas se acercan. Y otras cosas también."],
      honorLow: ["Ah. Una sombra afín."],
    },
  },
  merchant_travel: {
    name: "Zoltan el mercader ambulante",
    talk: [["¡Género! ¡Género maravilloso! ¡De tierras que no conoces, a precios que no olvidarás!", "No se admiten devoluciones. Ni preguntas. Alguna respuesta, quizá."]],
  },
  stranger_box: {
    name: "Viajero misterioso",
    talk: [["Una caja. Cincuenta de oro. ¿Qué hay dentro? Algo. Quizá maravilloso. Quizá un calcetín.", "¿Te sientes con suerte? Deberías. O no. Ahí está la gracia."]],
  },
  grisby: {
    name: "Grisby el Buhonero",
    talk: [
      ["¡Un cliente! ¡Uno de verdad! Todo auténtico, todo legal, todo *mío*.", "¿Que de dónde lo he sacado? Me lo encontré. ¿Que dónde? Al lado de su dueño."],
      ["Sí, soy un trasgo. Sí, mis primos están en el Túmulo intentando apuñalarte. No nos hablamos. La familia, ya sabes."],
      ["¿Esa poción? La he probado yo mismo. Bueno, se la di a Nargle. Nargle está bien. Nargle está *casi* bien."],
    ],
    lines: { hit: ["¡EH! ¡Que tengo *licencia*! ¡En algún sitio!"] },
  },
  olwen: {
    name: "La vieja Olwen",
    talk: [
      ["Raíz sanadora para los cortes, pétalo lunar para el alma y flor de ascua para cuando el alma necesita una buena patada.", "Sesenta años recorriendo este bosque. Y el bosque me ha recorrido a mí otras dos veces."],
      ["No te comas las setas azules, cielo. Bueno. No te las comas *dos veces*."],
    ],
  },
  lucky_lou: {
    name: "Lou el Suertudo",
    talk: [
      ["Me llamo Lou y lo mío es la suerte. La vendo a granel.", "¿Que por qué la vendo en vez de usarla? Mira. *Mira.* Esas preguntas no se hacen."],
      ["¿Estos dados? No han perdido una tirada en su vida. Y a mí no me dejan entrar en ninguna taberna. Unas por otras."],
    ],
  },
  sir_reginald: {
    name: "Sir Reginald (jubilado)",
    talk: [
      ["¡Este yelmo me acompañó en el Asedio de Refunfuñón! Bueno. Yo vi el asedio. Desde una colina. A través del yelmo.", "Tuyo por un precio muy razonable."],
      ["Cuarenta años de caballero y lo único que me queda es esta armadura y una rodilla fastidiada. Llévate la armadura. De la rodilla, ni te acerques."],
    ],
  },
  rika: {
    name: "Rika la Trampera",
    talk: [
      ["Flechas. Arcos. Carne. Sin regatear, sin charla, y no pises el lazo que tienes detrás.", "…El otro lazo. Sí. Ese."],
      ["Los lobos salen de noche. No son malos, tienen hambre. ¿Que si hay mucha diferencia cuando te comen a ti? Pues no."],
    ],
  },
  ottis: {
    name: "Ottis el Leñador",
    talk: [["¿Has visto un hacha? Así de larga, con forma de hacha, responde al nombre de «Bertha»."]],
    lines: {
      "quest:start": [
        "¿Has visto un hacha? Así de larga, con forma de hacha, responde al nombre de «Bertha».",
        "La dejé un momento para echarme la siesta. UN momento. Me despierto y ni rastro. Tiene que estar por el bosque.",
        "Si me la encuentras te lo agradezco como es debido. Y ni una palabra de que un leñador ha perdido el hacha, que me lo van a estar recordando toda la vida.",
      ],
      "quest:waiting": ["¿Nada de Bertha? Tiene el mango rojo. Y mucho carácter."],
      "quest:found": ["¡BERTHA! ¡Mi niña! Mírala, llena de hojas.", "Toma, por las molestias. Y si alguien pregunta, no la perdí. Se fue a dar una vuelta."],
      "quest:done": ["Bertha y yo no nos separamos más. Bueno, salvo que se quede atascada en un tocón."],
    },
  },
  petunia: {
    name: "La abuela Petunia",
    talk: [["Cinco hierbas, cielo. ¡Cinco! Que las rodillas ya no me doblan y el caldo no se hace solo."]],
    lines: {
      "quest:start": ["¡Ay, una criatura con las rodillas en su sitio! Tráele a la abuela cinco hierbas y te pago como Dios manda. Nada de pagarte «en visibilidad»."],
      "quest:ready": ["¡Cinco hierbas! Qué maravilla. Huele, huele. Eso es caldito, eso. Caldito y siesta."],
      "quest:waiting": ["Cinco hierbas, cielo. Llevas {have}. Que la abuela sabe contar, ¿eh?"],
      "quest:done": ["El caldo ya está al fuego. Te invitaría, pero me lo pienso comer entero. Para eso es el caldo."],
    },
  },
  sir_loin: {
    name: "Sir Solomillo de Vacaflor",
    talk: [["Me he perdido. No preguntes cómo. Tenía un mapa. En el mapa salía una ardilla. Seguí a la ardilla."]],
    lines: {
      "quest:start": [
        "¡Ah! ¡Alguien de por aquí! Estupendo. Estoy en una gran gesta para acabar con la Temible Bestia de la Espesura.",
        "¿Hacia dónde queda la Espesura? …Al norte. Claro. ¿Y hacia dónde queda el norte? …Ya. Sí. Lo sabía.",
        "Toma, por las molestias. Un caballero siempre paga sus deudas. Con lo que lleve en los bolsillos.",
      ],
      "quest:done": ["¡Adelante! ¡A la gloria! …Por el camino esta vez. Nada de ardillas."],
    },
  },
  grubnak: {
    name: "Grubnak",
    talk: [
      ["Ay, no. Ay, no, no. Eres tú. La persona esa del Túmulo. Mira, que hoy libro.", "Yo no te apuñalo, tú no me apuñalas, y nos quedamos aquí disfrutando del bocata como gente civilizada."],
      ["Diez años vigilando el piso dos. Diez años. ¿Sabes cuánta gente me ha dado los buenos días? Ni uno."],
      ["El jefe quiere que «acechemos con más amenaza». No sé ni qué significa. Yo acecho de maravilla."],
    ],
    lines: { hit: ["¿En mi DÍA LIBRE? Muy bien. Esto va a Recursos Humanos.", "¡Eh! ¡Que es un pícnic! ¡Normas de pícnic!"] },
  },
  prophet: {
    name: "El Profeta de las Setas",
    talk: [["Las esporas han hablado. Siéntate. Escucha. O no. Las esporas ya saben qué vas a hacer."]],
    lines: {
      prophecy: [
        "Una gran fortuna te espera… en el fondo de algo. Puede que un pozo. Puede que una empanada.",
        "Cuídate del hombre de las dos botas izquierdas. No es peligroso. Es que va muy, muy perdido.",
        "Hoy perderás algo pequeño y encontrarás algo grande. Las esporas no tienen claro si es un oso.",
        "Los dados te sonreirán una vez. Solo una. Las esporas no dicen cuándo. Las esporas son muy *rencorosas*.",
        "Alguien del pueblo te quiere. O te debe dinero. Las esporas no se aclaran con los sentimientos.",
        "Esta noche la luna te estará mirando. No le impresionas. Esfuérzate más.",
      ],
    },
  },
  sleepwalker: {
    name: "Hob (dormido)",
    talk: [
      ["…cinco minutitos más, mamá…", "…que no, Duquesa, que la cerda no duerme en la cama grande…", "*ronquido*"],
      ["…quiero denunciar a un nabo…", "…él sabe lo que hizo…", "*snrrk*"],
    ],
  },
  ned: {
    name: "El granjero Ned",
    talk: [
      ["Nabos, te lo digo yo. El futuro son los nabos. Todo el mundo se ríe hasta que llega un asedio y se están comiendo MIS nabos."],
      ["Mags dice que mis zanahorias son «agresivamente naranjas». Que diga lo que quiera. Desde ALLÍ."],
      ["Algo se come las lechugas por la noche. Tengo tres sospechosos: un conejo, un trasgo o Hob."],
    ],
  },
  mags: {
    name: "La vieja Mags",
    talk: [
      ["Setenta y tres años en este pueblo y lo he visto todo dos veces. La segunda fue peor."],
      ["Ned cría nabos del tamaño de la cabeza de un bebé. Eso no es natural. He escrito al Consejo. No hay Consejo. Pero yo escribo igual."],
      ["Tú eres quien se cayó en el túmulo, ¿no? ¿No? Pues tienes cara de ir a caerte en el túmulo."],
    ],
  },
  tam: {
    name: "Tam",
    talk: [
      ["¿Tú vives de aventuras? ¿Has matado un dragón? ¿DOS dragones? ¿Me dejas la espada? ¿Me la dejas ya? ¿Y ahora?"],
      ["Bea dice que si te tragas un pétalo lunar ves fantasmas. Me he tragado tres. Nada. Bea es una mentirosa. Y me encuentro raro."],
    ],
  },
  bea: {
    name: "Bea",
    talk: [
      ["De mayor voy a ser bruja. O panadera. O una bruja que hace pan. Pan malvado."],
      ["Tam se ha tragado tres pétalos lunares. Yo no le dije que lo hiciera. Solo dije que *podía* pasar. Las palabras tienen poder."],
    ],
  },
  bryn: {
    name: "La guardia Bryn",
    talk: [
      ["La espada, envainada dentro del pueblo. La semana pasada uno se puso a «practicar» con el pozo. Ganó el pozo."],
      ["Día tranquilo. Me encantan los días tranquilos. Nadie escribe canciones sobre días tranquilos, y así me gusta a mí."],
    ],
    lines: { honorLow: ["Te tengo echado el ojo. Los dos ojos. He estado practicando."] },
  },
  gus: {
    name: "Gus el Minero",
    talk: [
      ["Treinta años metido en ese agujero. ¿Sabes lo que he encontrado? Piedras. Piedras preciosas. Bueno, alguna brillante. Casi todas piedras."],
      ["Si oyes golpecitos en las galerías hondas, no contestes. Yo contesté una vez. Todavía no nos hablamos."],
    ],
    night: [["*hip* …lo bueno de la piedra… es que siempre está ahí. No como Maureen."]],
  },
  ingrid: {
    name: "Ingrid la Erudita",
    talk: [
      ["Estoy escribiendo la historia definitiva de Wildkeep. Capítulo uno: «Un pueblo». Capítulo dos: «Sigue siendo un pueblo». En el nueve se pone interesante."],
      ["Dato curioso: el túmulo es más antiguo que el pueblo. Dato menos curioso: lo que hay dentro, también."],
      ["El nombre de la taberna es técnicamente una calumnia. Nunca hubo un guiverno. Hubo un ganso muy borracho."],
    ],
  },
  may: {
    name: "La hermana May",
    talk: [
      ["No te muevas. Ya está. Arreglado. Intenta volver mañana con el mismo número de piezas."],
      ["¿Moratones, cortes, alguna maldición leve? Moratones y cortes, sí. Maldiciones, los martes."],
    ],
    lines: {
      healed: ["No te muevas… ya está. De estreno. Bueno, de segunda mano."],
      healthy: ["Yo te veo bien. Vuelve cuando se te caiga algo."],
    },
  },
  bella: {
    name: "Bella",
    talk: [["¡Flores! ¡Hierbas! ¡Empanadas! Todo lo de mi puesto está criado con cariño. Y con un poco de estiércol. Pero sobre todo cariño."]],
  },
  tomas: {
    name: "Tomás",
    talk: [["Carne, pan, flechas y un calcetín que me encontré. El calcetín no se vende. El calcetín da suerte."]],
  },
  barnaby: {
    name: "Barnaby",
    talk: [
      ["¿Sabes cuál es tu problema? Que tienes cara. Todo el mundo tiene cara. Ese es el problema. Las caras."],
      ["El mejor consejo que me han dado: nunca te pelees con un ganso. El segundo mejor: si te peleas con un ganso, ve a por las rodillas. Los gansos no tienen rodillas. Ahí está el truco."],
      ["¿Quieres un consejo? Apuéstalo todo al rojo. Luego todo al negro. Así lo tienes cubierto. No puedes perder. *hip*"],
    ],
  },
  dice_goblin: {
    name: "Trasgo tahúr",
    talk: [
      ["¡Eh! ¡Tú! ¡Sí, tú! Estamos en el descanso. Normas del sindicato. En el descanso no se apuñala.", "¿Te echas una tirada? Diez de oro. Si sacas más que nosotros, te llevas veinticinco. Es muy justo. Lo hemos comprobado."],
      ["No le digas al Caudillo que tenemos dados. Se cree que estamos «patrullando». Y ESTAMOS patrullando. Sentados."],
      ["Nargle hace trampas. Nargle siempre hace trampas. Nargle, suelta los OTROS dados."],
    ],
    lines: { hit: ["¡DESCANSO! ¡QUE ESTAMOS EN EL DESCANSO!", "¡Eh! ¡En mitad de la partida no!"] },
  },
  wendel: { name: "El viejo Wendel", talk: [["Esa valla lleva cuarenta años en MI lado de la linde."]] },
  pruett: { name: "La viuda Pruett", talk: [["Su valla. SU valla. Se me está cayendo encima de los rosales."]] },
  nico: { name: "Nico el Ligero", talk: [["¡Encuentra el guisante y gana la bolsa! ¡Fácil como respirar! ¡Más fácil, para algunos!"]] },
  wim: { name: "Wim el Escurridizo", talk: [["¿Qué? Solo estoy andando. Rápido. Normal de rápido."]] },
  marit: {
    name: "Marit la pescadora",
    talk: [
      ["Buenos días. O buenas tardes. Aquí una deja de contar y se pone a esperar."],
      ["Con lombriz pican antes. De noche suben los raros: sobre todo la escama lunar. Brilla como un farol que se le ha caído a alguien."],
      ["Tobin dice que pescó una carpa dorada en el 42. Y yo digo que Tobin dice muchas cosas."],
      ["El pescado, a la cocina: a la brasa o en caldereta. Una buena caldereta te da cuerda para todo el día."],
    ],
    night: [["De noche el lago habla. Casi siempre dice «plop». A veces algo más gordo."]],
    lines: {
      "event:storm": ["Con tormenta se pesca mejor que en todo el año. Eso sí, fatal para el sombrero."],
      honorHigh: ["Dicen que eres buena gente. Siéntate. No hables. Es el mejor cumplido que doy."],
    },
  },
  ysolde: {
    name: "Ysolde de la Torre Torcida",
    talk: [
      ["La magia es sobre todo papeleo. El resto es no quemarte las cejas. Primero la Chispa; las cejas, después."],
      ["El maná vuelve solo si dejas de ir lanzándolo por ahí. Las pociones azules ayudan. No morirse, también."],
      ["La torre se inclina porque está escuchando. El qué, prefiero no decirlo. Le da vergüenza."],
      ["Tengo más que enseñarte. Tú tienes más que demostrar. Ya llegaremos. Despacio. Soy muy vieja, muy paciente y estoy muy ocupada."],
    ],
    night: [["Han salido las estrellas. No me hables, que las estoy contando. …Ya me has hecho perder la cuenta."]],
    lines: {
      honorLow: ["Sé lo que has estado haciendo. Las estrellas cotillean. Aunque, bueno, Greta también."],
      honorHigh: ["En el pueblo hablan bien de ti. En el pueblo también dicen que me como a los niños. Con pinzas."],
    },
  },
  garrick: {
    name: "Garrick el cazador",
    talk: [
      ["Cazar es fácil. Los animales te notan antes que tú a ellos. Camina, no corras: correr es lo más ruidoso que puedes hacer.", "Los ciervos y los conejos salen pitando. Los jabalíes no. Los jabalíes van a por ti. Respeta al jabalí."],
      ["Lo mejor es el arco: disparas antes de que se pongan nerviosos. La espada vale si consigues acorralar algo, que no vas a conseguir."],
      ["Tráeme pieles, carne, cornamentas. Te las pago mejor que Mira, que las amontona al lado de los nabos."],
      ["La carne, asada en casa antes de comértela. No debería tener que decirlo. He tenido que decirlo."],
    ],
  },
  alma: {
    name: "La hermana Alma",
    talk: [
      ["El santuario es de todos. Siéntate un rato. Dile algo, o no: ella escucha igual."],
      ["El cepillo da de comer a tres familias este invierno. Cada moneda cuenta. Cada gesto amable también, pero con eso no se compra pan."],
      ["La gente cree que el honor es no hacer nunca nada malo. No es eso. Es lo que haces después."],
    ],
    lines: {
      honorLow: ["He oído cosas. No estoy aquí para juzgarte. Estoy aquí por si quieres hacerlo mejor."],
      honorHigh: ["Todo el callejón habla de ti. Bien, para variar. Enhorabuena."],
    },
  },
  nell: {
    name: "Nell",
    talk: [
      ["Estos dos son Nabo y También Nabo. Les puso nombre Hob. Hob a todo le llama Nabo."],
      ["La famosa es Duquesa. Estos son los que se quedan en la cochiquera. Héroes anónimos."],
      ["¿Un consejo? Los cerdos encuentran trufas. Estos dos encuentran el único hueco de cualquier valla."],
    ],
  },
  otto: {
    name: "El viejo Otto",
    talk: [
      ["He perdido un zapato. El izquierdo. O el derecho. El que no está.", "La última vez que lo tuve estaba en el lago. O el lago estaba en mí."],
      ["Tobin dice que pescó una carpa dorada. Yo la vi. Era una bota. A lo mejor era mi bota."],
      ["De jóvenes no teníamos mapa. Teníamos un palo. Apuntabas y andabas. Casi siempre contra un árbol."],
    ],
  },
  kid_tilly: {
    name: "Tilly",
    talk: [["¡Tú la llevas! …Tienes que correr detrás de nosotros. Así FUNCIONA."], ["Bo dice que eres caballero. Yo digo que eres un granjero muy alto."], ["¿Sabías que el ángel del santuario se mueve de noche? Me lo ha dicho Bo. Bo miente."]],
  },
  kid_bo: {
    name: "Bo",
    talk: [["Voy a ser aventurero. Tengo un palo y todo."], ["Tilly hace trampas al pillapilla. Dice «la llevas» y luego dice que ella nunca la llevaba. Así no se juega."], ["En el patio hay un muñeco de paja. Me peleo con él todos los días. Creo que voy ganando. Él no dice nada."]],
  },
};

/** Frases sueltas que dicen en voz alta cuando pasas cerca. */
export const ES_BARKS: Record<string, readonly string[]> = {
  mira: ["¡Pociones frescas! ¡Casi sin caducar!", "¡Liquidación total! Menos el mostrador. El mostrador lo necesito.", "Compro mineral, vendo esperanza."],
  bram: ["*CLANG* *CLANG*", "Metal caliente, cerveza fría. Eso es vida.", "¡Cuidado con las chispas!"],
  apprentice: ["Algún día tendré mi propio pico. Uno de verdad.", "¿Es ya la hora de comer?"],
  tobin: ["En mis tiempos, las mazmorras tenían un nivel.", "Mmm. Cambia el tiempo. O cambio yo."],
  finn: ["Psst.", "Yo no he estado aquí.", "Bonitas botas. Sería una pena que… no, nada, olvídalo."],
  watchman: ["¡Alto! Ah, eres tú. Siga, siga.", "Las doce en punto y todo… bien, supongo."],
  hale: ["¡Árbol va!", "Buena madera, hoy.", "¿Hueles eso? Pino y ambición."],
  dorrin: ["¡Roca y piedra!", "¿Has oído eso? ¿No? Mejor."],
  hob: ["Una manita más, con el dinero de los nabos…", "La Duquesa sabría qué hacer.", "¡Carta! No, espera…"],
  greta: ["¿Quién ha pedido el guiso? Alguien ha pedido el guiso.", "¡Nada de cantar encima de las mesas! Lyra, va por ti también.", "¡Última ronda! …Es broma. Aquí no cerramos nunca."],
  pip: ["¡Paso!", "¡Cuidado con los codos!", "¡¿De quién es el guiso?!", "¡Que quema! ¡Que quema!"],
  rowan: ["En mis tiempos peleábamos con palos. Cuesta arriba.", "Mmm, buena cerveza."],
  cook: ["¡¿QUIÉN ha tocado mi cucharón?!", "¡Pip! ¡El guiso no se sirve solo!", "No está quemado. Está caramelizado."],
  silas: ["Hagan sus apuestas.", "La casa se lo agradece.", "La suerte sonríe a… bueno. A mí."],
  vex: ["Vueltas y más vueltas, querido.", "Esta noche el Dragón tiene hambre."],
  lyra: ["♪ La la laaa… ♪", "♪ Abajo, abajo, en el túmulo… ♪", "♪ El guiso frío y la cerveza caliente… ♪"],
  gambler_1: ["Una más. Solo una.", "Venga, venga, venga…", "Lo noto. Esta es la buena."],
  gambler_2: ["La Suerte me debe dinero.", "¡Ja! Ja. …Ja."],
  traveler_1: ["Mis pies. Mis pobres pies."],
  traveler_2: ["Cinco coma veintiséis…", "Interesante. Muy interesante."],
  patron_1: ["*hip*", "¡Me encanta esta canción! ¿Qué canción es?", "No estoy borracho, es el SUELO."],
  patron_2: ["Chsss. Que no estoy.", "¿Alguien ha visto mis botas?"],
  bouncer: ["…", "Solo socios.", "Buena noche para ello."],
  morg: ["Aaah. Nada como una cerveza después de un día entero acechando.", "Eh, saco de huesos. Te toca repartir.", "No me mires así, que estoy fuera de servicio."],
  rattles: ["¡Carta! …Ah, me ha dado. En la costilla.", "¡Que aproveche, que es de hueso!", "Morg hace trampas a las cartas. Con los COLMILLOS.", "No estoy delgado, es que soy de hueso ancho. De hueso, sobre todo."],
  wick: ["He visto cosas. Sobre todo el fondo de esta jarra.", "¡Chupa la roca!", "¿Te he contado lo de la cabra?"],
  hooded: ["…", "Aún no es la hora.", "Sé lo que hiciste. Y lo que vas a hacer."],
  merchant_travel: ["¡Género!", "¡Todo auténtico! ¡Casi todo!", "¡Solo hoy! ¡Quizá mañana también!"],
  stranger_box: ["Cajas…", "Cincuenta de oro. Una caja. Un destino."],
  grisby: ["¡Género! ¡Casi sin robar!", "Sin devoluciones, sin recibos, sin preguntas.", "Pss. Humano. ¿Quieres un calcetín?"],
  olwen: ["¡Hierbas! ¡Raíces! ¡Opiniones!", "Cuidado con las ortigas, cielo.", "Los árboles están cotilleando sobre ti."],
  lucky_lou: ["¿Te sientes con suerte? Tienes cara de suerte.", "¡La fortuna sonríe al que compra!", "¡Amuletos! ¡Baratijas! ¡Cero maldiciones!"],
  sir_reginald: ["¡Acero de calidad! ¡Levemente abollado!", "En mis tiempos los dragones eran dragones *de verdad*.", "Liquidación total. Yo incluido, algún día."],
  rika: ["Silencio. Espantas a los conejos.", "Flechas, dos por moneda.", "Mm."],
  ottis: ["¿Bertha? ¿BERTHA?", "Un hacha no se va andando…", "¿A quién se le ocurre echarse la siesta al lado de un barranco? A mí, por lo visto."],
  petunia: ["¡Ay, mis rodillas!", "Cinco hierbas. Tampoco es tanto pedir.", "En mis tiempos las hierbas venían solas."],
  sir_loin: ["¡Adelante! Esto… ¿hacia dónde es adelante?", "¿Alguien ha visto una ardilla con un mapa?", "No estoy perdido. Estoy *de gesta*."],
  grubnak: ["Buen día para esto.", "No le digas al jefe que me has visto.", "Mm. Pepinillos."],
  prophet: ["Las esporas susurran…", "Seeeeetas.", "He visto el futuro. Está húmedo."],
  sleepwalker: ["zzz…", "…los nabos no…", "*ronquido*"],
  ned: ["Los nabos no se plantan solos.", "¡Mags! ¡Que tu gato está otra vez en mis judías!", "Lluvia. Por fin. O no. Lo de siempre."],
  mags: ["En mis tiempos todo esto era campo.", "¡Ned! ¡Que tus nabos me están MIRANDO!", "La juventud. Siempre andando de aquí para allá."],
  tam: ["¡Te echo una carrera!", "¡No debería estar aquí!", "¡BEA! ¡BEA, MIRA!"],
  bea: ["Chsss, estoy cazando un escarabajo.", "Tam está haciendo el tonto otra vez.", "¿Quieres ver un gusano?"],
  bryn: ["Circulen.", "No se corre entre los puestos.", "Todo en orden. Sospechosamente en orden."],
  gus: ["¡Carbón! ¡Precioso carbón!", "Cuidado con la cabeza. Y con los pies. Y con lo demás.", "¡Greta, otra ronda!"],
  ingrid: ["Fascinante.", "Eso es una nota al pie.", "¿Te has planteado leer?"],
  may: ["Cuidado dónde pisas, cielo.", "Curar es gratis. Dar las gracias, también.", "Jesús. ¿Has estornudado? Pues Jesús igualmente."],
  bella: ["¡Empanadas recién hechas!", "¿Flores para alguien especial?", "¡Hierbas cogidas esta mañana, palabra!"],
  tomas: ["¡Pierna asada! ¡Calentita más o menos!", "¡Flechas, tiradas de precio!", "El calcetín no se toca."],
  barnaby: ["♪ Ay, el guiverno iba piripi y yo también ♪", "*hip*", "¿Quién ha movido el suelo?", "No estoy borracho, estoy *de fiesta*."],
  dice_goblin: ["¡Doble uno!", "Venga, venga, venga…", "¡Nargle!", "¡Doble o nada!"],
  wendel: ["¡Cuarenta años!", "¡Esa valla es MÍA!", "¡Yo estaba aquí antes que tu ABUELA!", "¡Mídela! ¡Venga, mídela!"],
  pruett: ["¡Mis rosales!", "¡Se inclina! ¡Se INCLINA!", "¡La moviste de noche!", "¡Wendel, carcamal!"],
  nico: ["¡Encuentra el guisante! ¡Diez de oro!", "¡No le quites ojo al cubilete!", "¡Aquí gana todo el mundo! ¡Tarde o temprano!", "Y da vueltas, y da vueltas…"],
  wim: ["¡Aquí no hay nada que ver!", "¡Perdón! ¡Disculpe! ¡Paso, paso!"],
  marit: ["…Nada. Otra vez.", "Venga, venga, venga…", "Plop.", "Ese tenía espaldas."],
  ysolde: ["Mmm.", "¿Dónde habré puesto el…? No.", "Deja de tocar la torre."],
  garrick: ["Pies ligeros, pies ligeros.", "¿Hueles eso? Jabalí. O Ned.", "La piel vale más entera."],
  alma: ["Paz en tu camino.", "Cuidado con el escalón, que es más viejo que yo.", "Las velas no se encienden solas. Casi nunca."],
  nell: ["Atrás, Nabo. ATRÁS.", "¿Quién ha dejado la puer…? Nada, está cerrada.", "¡Cochi, cochi!"],
  otto: ["¿Dónde está mi zapato…?", "Qué día más bonito. Bonito. ¿Es de día?", "No voy borracho, voy relajado de piernas."],
  kid_tilly: ["¡La llevas!", "¡No me pillas!", "¡BO! ¡BO! ¡LA LLEVAS!"],
  kid_bo: ["¡Yo no la llevo!", "¡Tilly, ESPERA!", "¡Hiyaaa!"],
};
