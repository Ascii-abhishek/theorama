// Original, code-native editorial illustrations. All ink follows CSS currentColor.
const star = (x, y, r = 5) =>
  `<path d="M${x - r} ${y}h${r * 2}M${x} ${y - r}v${r * 2}"/>`;
const dots = (items) =>
  items
    .map(
      ([x, y, r = 2]) =>
        `<circle cx="${x}" cy="${y}" r="${r}" fill="currentColor" stroke="none"/>`,
    )
    .join("");
const hatch = (x, y, count, dx = 4, length = 13) =>
  Array.from(
    { length: count },
    (_, i) =>
      `<path d="M${x + i * dx} ${y}l-${length * 0.48} ${length}" stroke-width="1" opacity=".65"/>`,
  ).join("");

const wing = `<path d="M97 79C84 55 47 23 24 29C8 34 21 64 37 79C53 95 78 96 97 85Z"/>
  <path d="M95 87C76 85 52 90 42 108C31 127 46 148 61 142C78 136 89 109 97 94Z"/>
  <path d="M94 78C72 60 46 40 27 36M95 81C71 70 48 58 24 45M96 85C68 83 42 70 30 57M91 91C76 102 65 117 58 136M89 95C69 105 51 112 45 123M88 93C69 95 52 99 45 110" stroke-width="1.2"/>
  <path d="M34 37C34 48 42 56 49 55C57 48 45 37 34 37Z" fill="currentColor"/>
  <path d="M54 52C54 62 65 71 72 68C76 62 63 51 54 52Z" fill="currentColor"/>
  <path d="M37 63C42 73 53 80 58 76C58 69 45 61 37 63Z" fill="currentColor"/>
  <path d="M51 111C51 121 57 127 61 122C67 114 70 107 68 103C64 102 56 107 51 111Z" fill="currentColor"/>
  <path d="M75 91L67 80M83 94L76 81M83 107L76 101M77 118L69 113M72 128L64 123M64 137L59 131" stroke-width="1"/>
  <path d="M22 39l10 2M24 48l10 2M28 57l10 3M35 68l9 2M42 78l8-2M49 84l7-4M57 88l7-5M67 91l7-6" stroke-width="1.15"/>`;

const drawings = {
  "butterfly-effect": `<g class="art-orbit" opacity=".5"><path d="M26 123C-3 105 15 17 91 20C156 20 206 79 171 126C147 161 66 164 30 136" stroke-dasharray="2 6"/><path d="M157 19c6 9 5 18-1 26M155 43l-2-8m2 8 8-4"/></g><g class="art-wings">${wing}<g transform="translate(200 0) scale(-1 1)">${wing}</g></g><path d="M99 67C93 74 93 99 100 119C106 100 107 76 102 67Z" fill="currentColor"/><circle cx="100" cy="66" r="4" fill="currentColor"/><path d="M98 65C90 49 88 42 83 42M102 65c8-16 10-23 15-23"/><circle cx="83" cy="42" r="1.8" fill="currentColor"/><circle cx="117" cy="42" r="1.8" fill="currentColor"/>${star(173, 37, 5)}${star(22, 143, 4)}${dots(
    [
      [163, 147],
      [32, 21],
      [179, 101, 1.3],
    ],
  )}`,

  "parkinsons-law": `<path d="M72 42h51l10 12M75 40v-9h43v10M83 31v-7h28v7"/><path d="M51 58C58 38 84 42 105 45C130 49 150 57 150 77V115C149 134 132 132 128 116C125 103 119 108 121 131C123 151 107 160 98 143C90 128 89 135 90 143C92 159 75 158 72 145C69 133 73 126 64 118C47 103 41 79 51 58Z"/><path d="M60 63C68 49 94 51 112 55C133 60 142 69 140 85C137 104 112 116 94 109C75 101 52 82 60 63Z"/><path d="M97 60v5M126 76l-5 2M116 99l-3-5M75 88l5-2M73 61l4 4M99 80V66M99 80l16 8"/><circle cx="99" cy="80" r="3" fill="currentColor"/><path d="M43 148h121M53 155h20m62 0h19M151 56l12-13m-8 23h16M43 48l-7-10"/>${hatch(58, 91, 5, 4, 8)}${star(159, 126, 5)}`,

  "occams-razor": `<g transform="rotate(-24 100 90)"><path d="M41 65h120v39H41Z"/><path d="M48 65v39m106-39v39M58 72h86v25H58Z"/><path d="M86 73v7H76v8h10v8m27-23v7h10v8h-10v8M86 84h27"/><path d="M47 109h108M53 116h96M65 123h73" stroke-width="1"/><path d="M41 65l7-7h106l7 7M48 58v7m106-7v7"/></g><path d="M40 43c3-8 6-10 13-13M151 124c9 6 15 5 24 1M23 99h12m-6-6v12"/>${star(150, 35, 7)}${dots(
    [
      [57, 140],
      [172, 74, 1.5],
    ],
  )}`,

  entropy: `<path d="M64 28h75M64 32h75M65 147h74M65 152h74M73 33C73 65 91 70 96 88C96 104 72 116 73 146M130 33C130 65 111 72 106 88C106 104 131 115 130 146"/><path d="M76 44h51M79 49h45M83 55h37M87 61h29M91 67h21M96 74h11M101 86v22" stroke-width="1.1"/><path d="M79 137l22-19 24 19Z"/><path d="M86 132h30m-24-5h18" stroke-width="1"/>${dots(
    [
      [99, 103, 1],
      [102, 112, 1.5],
      [91, 119, 1.3],
      [111, 126, 1.3],
      [96, 133, 1.2],
      [107, 136, 1.2],
      [83, 138, 1.2],
      [117, 139, 1.2],
    ],
  )}<path d="M40 70l-10 7 10 7m-10-7h23M159 98l10 7-10 7m10-7h-23"/>${star(43, 121, 5)}${dots(
    [
      [153, 42, 2],
      [159, 60, 1],
      [42, 47, 1.5],
    ],
  )}`,

  "game-theory": `<path d="M62 139h80v10H62Zm7-9h66v9H69ZM77 121h50l8 9H69Z"/><path d="M81 120C66 103 92 92 88 76C74 85 61 79 57 72L72 51L79 31L92 43C108 40 125 49 132 63C142 83 126 99 128 120Z"/><path d="M79 32l6 23-16 16M90 49c19 4 32 17 28 32C115 94 96 99 94 116M76 68l9 1M69 77h10"/><circle cx="94" cy="58" r="2.4" fill="currentColor"/>${hatch(111, 91, 5, 3, 18)}<path d="M39 150h121M45 154h15m72 0h17M42 114v-10h10M44 104c1-12 6-20 15-25M157 58V48h-10m9 0c-2-10-9-16-16-19" stroke-dasharray="3 4"/>${star(157, 109, 5)}`,

  "natural-selection": `<path d="M99 145V69M99 116C72 119 54 105 53 82C81 78 99 92 99 116ZM99 91C99 65 119 50 146 52C144 79 123 94 99 91ZM99 79C75 77 62 60 67 39C91 42 104 58 99 79Z"/><path d="M99 113L60 88M99 89l40-30M99 77L72 45M75 98v-9m9 15v-9M116 77l11 2m-3-9 11 2M86 62l-9-1" stroke-width="1.2"/><path d="M84 145c0-13-13-18-24-15m40 15c0-12 13-18 26-16M69 150h63M79 155h42"/><path d="M39 44c-6 11-6 23 0 34m0-34c6 11 6 23 0 34m-4-26h8m-9 8h10m-9 8h8M156 98c-6 11-6 23 0 34m0-34c6 11 6 23 0 34m-4-26h8m-9 8h10m-9 8h8" stroke-width="1.1"/>${star(151, 35, 5)}`,

  "fermi-paradox": `<circle cx="101" cy="88" r="39"/><path d="M72 63C87 65 96 63 99 50M65 76c19-3 39 1 44 13s-9 25-1 37M123 58c-11 11-7 22 12 27M82 120c1-11-8-17-17-18" stroke-width="1.25"/><ellipse cx="101" cy="88" rx="76" ry="20" transform="rotate(-27 101 88)"/><path d="M34 110C63 112 129 78 164 54" stroke-width="5" opacity=".1"/><circle cx="160" cy="51" r="5" fill="currentColor"/><path d="M155 132c3-4 7-5 11-3s4 7-1 10l-4 3v4M161 152v1"/>${star(42, 40, 6)}${star(147, 28, 4)}${star(37, 138, 4)}${dots(
    [
      [163, 100, 1.5],
      [65, 29, 1.5],
      [124, 149, 2],
      [30, 78, 1.5],
      [114, 24, 1],
    ],
  )}`,

  "pareto-principle": `<path d="M34 140h139M40 139V44M51 138v-25h18v25m9 0V98h18v40m10 0V76h18v62m10 0V37h18v101"/><path d="M44 97C82 94 97 66 118 49C132 38 145 30 161 29M155 25l7 3-5 7"/>${hatch(139, 45, 3, 4, 85)}<path d="M51 148h18m9 0h18m10 0h18m10 0h18" stroke-width="1"/><path d="M49 55c8-11 14-14 26-16M54 37l-5 18 18 1" stroke-dasharray="2 4"/>${dots([[169, 80, 2]])}`,

  "dunning-kruger": `<circle cx="88" cy="75" r="43"/><circle cx="88" cy="75" r="36" stroke-width="1.2"/><path d="M116 108l9 10m-4-16 10 10M125 112l9-1 31 32c4 5-3 12-8 8l-32-31Z"/><path d="M131 121l6-6m-1 11 6-6m-1 11 6-6m-1 11 6-6m-1 11 6-6m-1 11 6-6" stroke-width="1"/><path d="M61 75C74 57 102 57 115 75C102 93 74 93 61 75Z"/><circle cx="88" cy="75" r="12"/><path d="M86 69a6 6 0 1 0 8 8a5 5 0 0 1-8-8Z" fill="currentColor" stroke="none"/><path d="M66 68l-3-4m10-3-2-5m11 4-1-5m12 5 1-5m10 8 3-5m4 11 4-4M67 83l-4 4m11 1-2 5m11-3-1 5m12-5 1 5m9-8 3 5m3-10 4 4" stroke-width="1"/><path d="M61 56c4-7 11-11 19-12M58 63l-1 4M88 23v-6m-52 58h-6m110 0h6M88 126v6M41 122c-5 7-6 14-3 21m-5-7 5 7 7-4"/>${star(150, 38, 6)}${star(59, 145, 4)}${dots(
    [
      [158, 91, 1.5],
      [35, 36, 1.5],
      [111, 151, 1.5],
    ],
  )}`,

  relativity: `<g stroke-width="1.2"><path d="M26 59Q100 51 174 59M22 75Q100 70 178 75M19 92Q100 105 181 92M16 110Q100 149 184 110M13 129Q100 169 187 129M41 44Q23 96 30 146M62 43Q39 107 63 153M82 42Q63 110 86 157M103 42Q85 114 109 157M124 43Q115 111 133 153M145 44Q146 105 156 149M165 45Q174 98 178 143"/></g><circle cx="105" cy="90" r="24" fill="var(--art-paper, #f4f0e6)"/><path d="M83 90c10 9 35 15 45 7M89 73c14 1 28 9 35 20M89 105c9 1 21 7 28 5" stroke-width="1"/><path d="M55 30c25-11 58-12 80-2m-4-5 5 5-8 3"/><circle cx="48" cy="32" r="5" fill="currentColor"/>${star(157, 29, 5)}${dots(
    [
      [22, 34, 1.5],
      [177, 34, 1.5],
    ],
  )}`,

  "godel-incompleteness": `<path d="M101 29L162 132H42Z" stroke-width="2.5"/><path d="M100 49l42 72H58ZM86 55l-40 69h79M117 58l34 65-10-2M58 123l-5 9m73-17 10 17M92 45l9-16"/><path d="M101 29l-9 16 42 72H58l-5 15M162 132l-20-11-42-72M42 132l16-11"/><path d="M88 84c-2-11 7-17 15-13c7 3 6 10 0 14l-4 3v9m0 6v1"/><path d="M29 67h16m-8-8v16M153 51h15m-15 5h15M69 151h17m-8-7v14M118 151h15" stroke-width="1.5"/>${dots(
    [
      [174, 104, 2],
      [47, 41, 1.5],
    ],
  )}`,

  "pythagorean-theorem": `<path d="M76 58v72h77Z" stroke-width="2.5"/><path d="M76 58H32v72h44M76 130v35h77v-35M76 58l35-38 77 72-35 38"/><path d="M76 116h14v14M40 67h27m-27 8h27m-27 8h27m-27 8h27m-27 8h27m-27 8h27m-27 8h27" stroke-width="1" opacity=".6"/><path d="M85 139h59m-59 8h59m-59 8h59" stroke-width="1" opacity=".6"/><path d="M84 51l77 72m-70-79 77 72m-70-79 77 72m-70-79 77 72" stroke-width="1" opacity=".6"/>${star(33, 36, 5)}${dots(
    [
      [178, 146, 2],
      [25, 151, 1.5],
    ],
  )}`,
};

export const hasIllustration = (id) => Object.hasOwn(drawings, id);

export function illustration(id, className = "") {
  const safeClass = String(className).replace(/["<>&]/g, "");
  return `<svg class="idea-illustration ${safeClass}" viewBox="0 0 200 180" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${hasIllustration(id) ? drawings[id] : drawings["butterfly-effect"]}</svg>`;
}
