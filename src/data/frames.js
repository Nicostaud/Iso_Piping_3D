/** Reference frames (geographic / ship), drawing planes and their axes. */
export const REF={
 geo:{ax:['E-W','N-S','vertical'],sg:[['E','W'],['N','S'],['↑','↓']],dir:['East','West','North','South','Up','Down'],north:'N',south:'S',east:'E',west:'W',az:'Az',d3:['East','North','Up'],v1:'Vert. E-W',v2:'Vert. N-S'},
 ship:{ax:['PS-SB','AFT-FWD','vertical'],sg:[['SB','PS'],['FWD','AFT'],['↑','↓']],dir:['SB','PS','FWD','AFT','Up','Down'],north:'FWD',south:'AFT',east:'SB',west:'PS',az:'Brg',d3:['SB','FWD','Up'],v1:'Vert. PS-SB',v2:'Vert. AFT-FWD'}};
export const CONSK=['ortho','H','EO','NS','R3'];
export const AXES={H:[0,1],EO:[0,2],NS:[1,2],R3:[0,1,2]};
