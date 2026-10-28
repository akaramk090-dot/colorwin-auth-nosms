'use strict';
// Presentation fixtures inferred from recovered component consumers.
const stamp=d=>d.toISOString().replace('T',' ').slice(0,19);
const issue=()=>{const now=new Date();return {issueNumber:'20261024000010001',serviceTime:stamp(now),startTime:stamp(new Date(+now-20000)),endTime:stamp(new Date(+now+40000)),intervalM:1};};
const page=()=>({list:[],dataList:[],gameslist:[],totalPage:0,totalCount:0,total:0,pageNo:1,pageSize:20,data:{date:{serviceTime:stamp(new Date())},gameslist:[]}});
function responseData(name,body={}){
 if(name==='undefined.json')return {intervalMinute:1,current:issue(),gameCode:'TRX1'};
 if(name==='GetHistoryIssuePage.json')return {result:true,data:page()};
 if(/^(Get5DtypeList|Get5DTypeList|GetK3TypeList|GetTRXtypeList|WinTxrGetTRXtypeList)$/.test(name)){const offset=name.includes('5D')?5:name.includes('K3')?9:13;return [1,3,5,10].map((minutes,i)=>({typeID:i+offset,typeName:`${name.includes('5D')?'5D':name.includes('K3')?'K3':'TRX'}<br />${minutes}Min`,tabName:`${minutes}Min`,intervalM:minutes,scope:'1|10|100|1000',sort:i+1,gamePresentation:'Local preview',betMultiple:'1|5|10|20|50|100'}));}
 if(/^(GetGame5DIssue|GetGameK3Issue)$/.test(name))return issue();
 if(name==='WinTxrGetTRXGameIssue'||name==='GetTRXGameIssue')return {predraw:issue(),settled:{issueNumber:'20261024000010000',number:'5',premium:'5',blockID:'0000000000000000000000000000000000000000000000000000000000000123',blockTime:stamp(new Date())}};
 if(/^(Get5DOddsList|GetK3OddsList)$/.test(name))return Array.from({length:30},(_,i)=>({id:i+1,playType:i+1,playTypeID:i+1,playRate:1.96,playRate_Original:1.96,playName:String(i),playCode:String(i)}));
 if(/^(Get5DOneEmerd|GetK3OneEmerd)$/.test(name))return {premium:name.includes('5D')?'12345':'123',sumCount:15,issueNumber:'20261024000010000',number:'1,2,3,4,5'};
 if(name==='GetLongDragon')return {list:[],serviceTime:stamp(new Date())};
 if(name==='GetLastFiveIssueNumberResult')return [];
 if(name==='Get4DGameConfig')return {betMultiplier:[1,5,10,20,50,100],betAmount:[10,50,100,500,1000],betType:[{type:1,name:'Straight'}],gameType:[{type:1,name:'4D'}]};
 if(name==='GetGame4DIssue')return [{date:stamp(new Date()).slice(0,10),games:[{type:1,typeName:'4D',issueNumber:'202610240001',startTime:issue().startTime,endTime:issue().endTime,serviceTime:issue().serviceTime}]}];
 if(name==='Get4DOddsList')return [{playTypeId:1,playTypeTitle:'4D',items:[{playId:'1',odds:9.6,playRate:9.6,name:'Straight'}]}];
 if(name==='GetGameTypeList')return [{typeId:1,typeName:'4D'}];
 if(/^(GetMy4DHistoryBetting|GetMyBingo18HistoryBetting)$/.test(name))return page();
 if(name==='Get4DGameResult')return [];
 if(name==='Get4DGameResultByType')return {firstPrize:'1234',secondPrize:'5678',thirdPrize:'9012',specialPrize:'0123,4567',consolationPrize:'3456,7890'};
 if(name==='GetBinguoGameConfig'||name==='GetBingo18GameConfig')return {betAmount:[10,50,100,500,1000],betMultiplier:[1,5,10,20,50,100]};
 if(name==='GetGameBingo18Issue')return issue();
 if(name==='GetBingo18LastGameResult')return {result:'246',resultSum:12,issueNo:'202610240001'};
 if(/^(GetBingo18Last50Result|GetBingo18OddsList|GetBingo18BetAmount|GetLotteryRankList|GetLotteryResult7Day)$/.test(name))return [];
 if(name==='GetTrendstatistics')return {resultSumTrend:[],smallAndBigTrend:[],threeSameTrend:[],twoSameTrend:[]};
 if(name==='GetUserRankList')return 0;
 if(name==='GetXosoGameBaseData')return {categorys:[],ares:[]};
 if(/^(GetXosoUserRecord|GetFXosoRecordPageList|GetFXosoResultPageList)$/.test(name))return page();
 if(/^(Get5DRuleByTypeId|GetK3RuleByTypeId)$/.test(name))return {rule:'Local interface preview. Outcomes and balances use sample data.'};
 if(/EmerdList|LotteryResult|WinTheLotteryResult/.test(name))return page();
 return undefined;
}
module.exports={responseData};
