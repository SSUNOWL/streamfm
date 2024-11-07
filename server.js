 
const express = require("express");
const app = express();

require('dotenv').config()

const methodOverride = require('method-override')
const bcrypt = require('bcrypt') 

const { MongoClient, ObjectId } = require('mongodb')
var cookieParser = require('cookie-parser')
const cors = require("cors");
app.set('view engine', 'ejs')
const fs = require('fs')
const axios = require('axios')

const youtubesearchapi = require("youtube-search-api");


// form 태그에서도 PUT과 DELETE를 사용가능하다!
app.use(methodOverride('_method'))
app.use(express.static(__dirname + '/public'))
//static 파일 == 이미지, css등 변동사항이 없는것
app.set('view engine', 'ejs')
app.use(express.json()) // 요청을 받아서 쉽게 출력하게 해줌
app.use(express.urlencoded({extended:true}))
// 세션방식의 로그인 기능 시 활용
const session = require('express-session')
const passport = require('passport')
const LocalStrategy = require('passport-local')
const MongoStore = require('connect-mongo')
//app.use 순서 유의


const sessionMiddleware = session({
  secret: "changeit",
  resave: true,
  saveUninitialized: true,
  store: MongoStore.create({ mongoUrl: process.env.DB_URL, dbName: "forum" }),

});


app.use(sessionMiddleware)

app.use(passport.initialize())
app.use(session({
  secret: '암호화에 쓸 비번',     //id를 암호화해서 유저에게 보냄
  resave : false,  //유저가 서버로 요청할때마다 세션을 갱신하는지
  saveUninitialized : false,  //로그인 안해도 세션을 만들지
    //cookie : { maxAge : 60 * 60 * 1000} //세션 저장 시간
    store : MongoStore.create({
        mongoUrl : process.env.DB_URL,
        dbName : 'forum'
    })// 로그인 할때마다 세션에 알아서 저장됨
}))

app.use(passport.session()) 

app.use(express.json()) // 요청을 받아서 쉽게 출력하게 해줌
app.use(express.urlencoded({extended:true}))
app.use(cookieParser())



const corsOptions = {
  //   origin: "https://mplayer1.netlify.app",
  origin: `http://localhost:${process.env.PORT}`, //your frontend url here
  credentials: true, //access-control-allow-credentials:true
  optionSuccessStatus: 200,
  exposedHeaders: "**",
};

app.use(cors(corsOptions));



const { createServer } = require('http')
const { Server } = require('socket.io')
const server = createServer(app)
const io = new Server(server) 

//socket.io 세팅
io.engine.use(sessionMiddleware)


const wrap = (middleware) => (socket, next) =>
  middleware(socket.request, {}, next);
io.use(wrap(sessionMiddleware));
io.use(wrap(passport.initialize()));
io.use(wrap(passport.session()));



let connectDB = require('./database.js');
const { time } = require("console");

let db
let changeStream
connectDB.then((client)=>{
  console.log('DB연결성공')
  db = client.db('streamfm')  // database 이름

  let 조건 = [
    { $match : { operationType : 'insert'}}
  ]
  changeStream = db.collection('post').watch(조건)

}).catch((err)=>{
  console.log(err)
})



const serv = server.listen(process.env.PORT, () => {
  console.log("Server running on port 8080");
});

serv.keepAliveTimeout = 61 * 1000
serv.headersTimeout = 65 * 1000



app.get('/register', (req, res) => {
  res.render('regist.ejs')

})

app.post('/register',  async(req, res) => {
  try {
          let all_user = await db.collection('user').find().toArray()
          var is_same = false 
          for ( var i in all_user) {
              
              if (all_user[i].username == req.body.username ) {
                  is_same = true
              }
          }
          if ( is_same ) {
              res.send('아이디가 동일함')
          } else {
              let hash = await bcrypt.hash(req.body.password, 10)
              await db.collection('user').insertOne({username: req.body.username, password: hash});
              res.redirect('/start') //특정 페이지로 이동
          }
          
      
  } catch(e) {
      console.log(e)
      res.status(500).send('서버에러')
  }
})

//hash를 사용하면 수정이 필요함
//login 할때 아이디 비번이 db와 동일한지 확인하는 것
//id/password외 다른것도 제출받아서 검증하고싶으면 passReqToCallback 옵션을 활용하면 됨
passport.use(new LocalStrategy(async (입력한아이디, 입력한비번, cb) => {
  let result = await db.collection('user').findOne({ username : 입력한아이디})
  //console.log(입력한아이디, 입력한비번)
  if (!result) {
    return cb(null, false, { message: '아이디 DB에 없음' })
  }
  

  if (await bcrypt.compare(입력한비번, result.password)) {
  //if (result.password == 입력한비번) {  //해시를 사용하지 않았을 경우
    return cb(null, result)
  } else {
    return cb(null, false, { message: '비번불일치' });
  }
}))

//실행시키고 싶을 때 passport.authenticate('local')사용

passport.serializeUser((user, done) => {
  //console.log(user) //user는 db에 있는 user정보를 알려줌
  process.nextTick(() => {
    done(null, { id: user._id, username: user.username })
      //성공적으로 로그인시 세션 document발행해줌 -> user정보의 _id를 쿠키에 적어줌
      // 
  })
})
// 세션에 기록될 내용을 현재는 메모리에 임시로 기록될예정 ( DB )
//nextTick == 내부코드를 비동기적으로 처리해줌


//유저가 보낸 쿠키 분석
//이코드 밑에서 요청.user를 사용하면 유저의 정보를 가져올 수 있음
passport.deserializeUser(async(user, done) => {
  let result = await db.collection('user').findOne({_id : new ObjectId(user.id)})
  delete result.password
  process.nextTick(() => {
    
    return done(null, user)
  })
})

app.get('/login', (req, res) => {
  // console.log(req.user) //현재 로그인 되어있는 유저의 정보
  if ( !req.user ) {
    res.render('login.ejs')
  } else {
    res.redirect('/start')
  }
})

app.post('/login', async(req, res, next) => {
  passport.authenticate('local', (error, user, info) => {
  //각각 error시, 성공시, 실패시이유가 적힘
      if (error) return res.status(500).json(error)
      if (!user) return res.status(401).json(info.message)
      req.logIn(user, (err) => {
          res.redirect('/start')
          //로그인시 하고 싶은 것
      })
      
  })(req, res, next)
  
})

app.get('/logout', async(req, res) => {
  if ( req.user ) {
  res.clearCookie('connect.sid')
  res.redirect('/login')
  } else {
    res.redirect('/login')
  }
  
})



app.get('/index/:roomId', async(req, res) => {

  var basic_info
  let result = await db.collection('streamroom').findOne({ _id : new ObjectId(req.params.roomId)})
  
  var server_time = result.started
  // var now = new Date()
  // var start_time = parseInt((now - server_time) / 1000)
  if ( !req.cookies.volume ) {
    res.cookie('volume', 50, {
      maxAge:10000
    })
  }

  res.render('index.ejs', {data : {
    roomId : req.params.roomId, 
    list : result.list,
    suggestion : result.suggestion,
    loop : result.loop,
    videoId : result.list[0].videoId,
    title : result.list[0].title,
    length : result.list[0].length,
    started : new Date(result.started),
    secto : secto,
    volume : req.cookies.volume ? req.cookies.volume : 50
  }})
 //데이터에 넣을 떄 추가

})

app.get('/suggest/:id', async(req, res) => {
  try {
    var Suggestions = await youtubesearchapi.GetVideoDetails(req.params.id)
    res.send(Suggestions)
  } catch(err) {
    var Suggestions = await youtubesearchapi.GetListByKeyword(req.params.id)
    
    res.status(400).json({error: err.message,error_line: err.stack});

    
  }
})  


app.get('/start', async(req, res) => {
  let result = await db.collection('streamroom').find().toArray()
// console.log(result)
  for ( var i = 0 ; i < result.length ; i++) {
    result[i]["room_num"] = room_num[result[i]._id]?.length
    
  }
  // console.log(result)
  res.render('start.ejs', {data : {
    room_list : result,
    user : req.user ? req.user.username : "",
  }})
})

app.post('/start', async(req, res) => {  
  if ( req.user ) {
    var url = new URL(req.body.url)
    const urlparams = url.searchParams
    var playlist = []
    var suggestion = []
    // console.log(req.body.random)
    if ( urlparams.get('list') ) {
      var playlists = await youtubesearchapi.GetPlaylistData( urlparams.get('list') )

      if ( urlparams.get('index') ) {

        for ( var i = (urlparams.get('index') - 1) ; i < playlists.items.length ; i++) {
          playlist.push({videoId : playlists.items[i].id, title : playlists.items[i].title, length : parseInt(timeto(playlists.items[i].length.simpleText))})
        }
        if ( req.body.random ) shuffle(playlist)
      } else {
        for ( var i = 0 ; i < playlists.items.length ; i++) {
          playlist.push({videoId : playlists.items[i].id, title : playlists.items[i].title, length : parseInt(timeto(playlists.items[i].length.simpleText))})
        }
        if ( req.body.random ) shuffle(playlist)

      }
      } else {
        
        var video
        var search_url = await youtubesearchapi.GetListByKeyword(`"` + urlparams.get('v') + `"`, false, 10, [{type : 'video'}] )
        for ( var song of search_url.items ) {
          if (urlparams.get('v') == song.id) {
            video = song
      
          }
        }
        if ( !video ) {
          var search_url = await youtubesearchapi.GetListByKeyword(urlparams.get('v'), false, 10, [{type : 'video'}] )
          for ( var song of search_url.items ) {
            if (urlparams.get('v') == song.id) {
              video = song
        
            }
          }
        }

        var suggest = await youtubesearchapi.GetVideoDetails(urlparams.get('v'))
        
        playlist.push({videoId : urlparams.get('v'), title : video.title, length : parseInt(timeto(video.length.simpleText))})
        for ( var i = 0 ; i < suggest.suggestion.length ; i++) {
          if ( !suggest.suggestion[i].isLive ) {
            suggestion.push({videoId : suggest.suggestion[i].id, title : suggest.suggestion[i].title, length : parseInt(timeto(suggest.suggestion[i].length.simpleText))})
          } 
        }
      } 
      var started = Date.now()

      let result = await db.collection('streamroom').insertOne({
        list : playlist, 
        started : new Date(started),
        suggestion : suggestion,
        loop : false,
      })
      res.redirect('/index/' + result.insertedId)
      } else {
        res.status(300).send('로그인을 해야합니다.')
      }
})



app.post('/update_volume', (req, res) => {
  
  res.cookie('volume', req.query.volume)
  res.send('volume updated')
})

app.post('/search', async(req, res) => {
  var result = await youtubesearchapi.GetListByKeyword(req.query.word + 'auto-generated', false, 5, [{type: 'video'}])
  var auto_playlist = []
  var search_playlist = []

  for ( var i = 0 ; i < result.items.length ; i++ ){
    if ( result.items[i].isLive == false )
      auto_playlist.push({
        Id : result.items[i].id,
        Title : result.items[i].title,
        length : result.items[i].length.simpleText,
        channelTitle : result.items[i].channelTitle
      })
  }

  result = await youtubesearchapi.GetListByKeyword(req.query.word, false, 5, [{type: 'video'}])

  for ( var i = 0 ; i < result.items.length ; i++ ){
    if ( result.items[i].isLive == false )
      search_playlist.push({
        Id : result.items[i].id,
        Title : result.items[i].title,
        length : result.items[i].length.simpleText,
        channelTitle : result.items[i].channelTitle
      })
  }


  if ( search_playlist.length == auto_playlist.length ){
    const playlist = search_playlist.reduce((arr, v,i) => {

      return arr.concat(v,auto_playlist[i])
      
    }, [])
  } else {
    var playlist = []
    Array.prototype.push.apply(playlist, result.list)
    Array.prototype.push.apply(playlist, result.suggestion)
    shuffle(playlist)
  }

  if ( playlist.length == 0) {
    res.status(300).send('검색결과가 없습니다')
  } else {
    res.status(200).send(playlist)

  }
  
})

app.post('/golive', async(req, res) => {
  var result = await db.collection('streamroom').findOne({_id : new ObjectId(req.body.roomId)})
  
  res.send(result.started)
})

app.post('/loop', async(req, res) => {
  var result = await db.collection('streamroom').updateOne( {_id : new ObjectId(req.body.roomId)}, {$set : {
      loop : req.body.loop
  }});
  if(result.modifiedCount) {
    res.status(200).send("convert to " + req.body.loop)
  } else { 
    res.status(501).send('server error')
  }

  io.to(req.body.roomId).emit('loop', {
    loop: req.body.loop
  })
})

app.post('/add', async(req, res) => {
  var result = await db.collection('streamroom').findOne({_id : new ObjectId(req.body.roomId)})
  var add_song

  var song_list = await youtubesearchapi.GetListByKeyword(`"` + req.body.videoId + `"`, false, 10, [{type: 'video'}])
  for ( var song of song_list.items ) {
    if (req.body.videoId == song.id) {
      add_song = song

    }
  }
  if ( !add_song ) {
    var song_list = await youtubesearchapi.GetListByKeyword(req.body.videoId, false, 10, [{type: 'video'}])
    for ( var song of song_list.items ) {
      if (req.body.videoId == song.id) {
        add_song = song

      }
    }
  }

  result.list.push({videoId : req.body.videoId, title : add_song.title, length : parseInt(timeto(add_song.length.simpleText))})
  
  var is_suggest = req.body.suggest == 'true' ? true : false
  if ( is_suggest ) {
    const idx = result.suggestion.findIndex(function(item) {return item.videoId === req.body.videoId}) // findIndex = find + indexOf
    if (idx > -1) result.suggestion.splice(idx, 1)
  } 

  await db.collection('streamroom').updateOne( {_id : new ObjectId(req.body.roomId)}, {$set : {
    list : result.list,
    suggestion : result.suggestion
  }});

  res.status(200)
  res.send('추가 완료')

  var new_result = await db.collection('streamroom').findOne({_id : new ObjectId(req.body.roomId)})

  io.to(req.body.roomId).emit('add', {
    videoId: req.body.videoId,
    list: new_result.list,
    suggestion: new_result.suggestion,
    suggest : req.body.suggest
  })
})

app.post('/delete', async(req, res) => {
  var result = await db.collection('streamroom').findOne({_id : new ObjectId(req.body.roomId)})
  var skip

  if ( !req.body.suggest ) {
    for(let i = 0; i < result.list.length; i++) {
      if (result.list[i].videoId == req.body.videoId) {
          skip = i
          result.list.splice(i, 1);
      }
    }
  } else {
    for(let i = 0; i < result.suggestion.length; i++) {
      if (result.suggestion[i].videoId == req.body.videoId) {
          skip = i
          result.suggestion.splice(i, 1);
      }
    }
    skip = 2 // suggestion 에서의 삭제는 skip이 필요없음
  }

  // console.log(skip)

  if ( skip > 0) {
    await db.collection('streamroom').updateOne( {_id : new ObjectId(req.body.roomId)}, {$set : {
      list : result.list,
      suggestion : result.suggestion
    }});
    
  res.status(200)
  res.send('삭제 완료')
  } else {
    res.status(200).send('현재 노래 스킵')
  }
  

  io.to(req.body.roomId).emit('delete', {
    videoId : req.body.videoId,
    isskip : skip == 0 ? true : false,
    list : result.list,
    suggestion : result.suggestion,
  })

})

io.use((socket, next) => {
  if (socket.request.user) {
    next();
  } else {
    // next(new Error('unauthorized'))
    next()
  }
});
// 로그인을 안하면 오류가 생김
var room_num = {}
var socketid_room = {}

io.on('connection', (socket) => {

  socket.on('add-join', (data) => {
    // console.log(socket.request.user)
    // console.log("join ", socket.id)
    socket.join(data.roomId)
    socket.join(socket.id)
    if ( !room_num[data.roomId] ) {
      room_num[data.roomId] = [{
        socketid : socket.id,
        user_id : socket.request.user ? socket.request.user.id : "",
        username : socket.request.user ? socket.request.user.username : "익명",
      }]
    } else {
      room_num[data.roomId].push({
        socketid : socket.id,
        user_id : socket.request.user ? socket.request.id : "",
        username : socket.request.user ? socket.request.user.username : "익명",
      })
    }
    
    socketid_room[socket.id] = data.roomId
    
    // console.log(room_num)
    io.to(data.roomId).emit('connected', {
      room_num : room_num[data.roomId]
    })
  })

  socket.on('log', (data) => {
  // console.log(data)
  
  })

  socket.on('disconnect', () => {
    // console.log(io.sockets.adapter.room)
    // console.log("socketio disconnect  ", socket.id)
    var roomId = socketid_room[socket.id]

    const idx = room_num[roomId].findIndex(function(item) {return item.socketid === socket.id}) // findIndex = find + indexOf
    if (idx > -1) room_num[roomId].splice(idx, 1)


    if ( room_num[roomId].length == 0) {
      delete room_num[roomId]
    }
    delete socketid_room[socket.id]
  
    // console.log(socketid_room)
    io.to(roomId).emit('disconnected', {
      socketid : socket.id
    })
  })

  socket.on('onended', async(data) => {
    var result = await db.collection('streamroom').findOne({_id : new ObjectId(data.roomId)})
    var now = new Date()
    
    var ended = new Date(result.started.getTime() + (result.list[0].length - 1) * 1000)
    // console.log(result.started.getTime(), (result.list[0].length) * 1000, ended, now, ended< now)
    // console.log(data.duration, result.list[0].length)
    
    const isvideo = (result.list[0].videoId == data.videoId)
    // console.log(isvideo)
    if ( isvideo ) {  // 바뀌지 않음
      if ( (ended < now ) || data.skip ) {
        var whole = []
        Array.prototype.push.apply(whole, result.list)
        Array.prototype.push.apply(whole, result.suggestion)
        // console.log(whole.length)
        
        if ( result.loop == false || data.deleted == true) {
          if (whole.length > 2) {
            result.list.shift()
          } else {
            result.list.shift()
            whole.shift()
            var new_suggest = await youtubesearchapi.GetVideoDetails(whole[0].videoId)
            // console.log(new_suggest.suggestion)
            for ( var i = 0 ; i < new_suggest.suggestion.length ; i++) {
              if ( !new_suggest.suggestion[i].isLive ) {
                result.suggestion.push({videoId : new_suggest.suggestion[i].id, title : new_suggest.suggestion[i].title, length : parseInt(timeto(new_suggest.suggestion[i].length.simpleText))})
              } 
            }
          }
        } else {
          var tmp = result.list[0]
          result.list.shift()
          result.list.push(tmp)
          

        }
        if ( result.list.length > 0 ) {
          // var detail = await youtubesearchapi.GetVideoDetails(result.list[0].videoId)
          // console.log(detail)
          var started = new Date()

        await db.collection('streamroom').updateOne( {_id : new ObjectId(data.roomId)}, {$set : {
          list : result.list, 
          started : new Date(started),
          suggestion : result.suggestion,
          // detail : {channel: detail.channel, description: detail.description, keywords: detail.keywords}
          }});
        } else {
          var list = []
          list.push(result.suggestion[0])
          result.suggestion.shift()
          // var detail = await youtubesearchapi.GetVideoDetails(list[0].videoId)
          var started = new Date()

          await db.collection('streamroom').updateOne( {_id : new ObjectId(data.roomId)}, {$set : {
            list : list, 
            started : new Date(started),
            suggestion : result.suggestion,
            // detail : {channel: detail.channel, description: detail.description, keywords: detail.keywords}

            }});
        }
        var after_result = await db.collection('streamroom').findOne({_id : new ObjectId(data.roomId)})

        io.to(data.roomId).emit('load', {
          videoId : after_result.list[0].videoId,
          title : after_result.list[0].title,
          started : new Date(after_result.started),
          length : after_result.list[0].length,
          exvideoId : data.videoId,
          list: after_result.list,
          suggestion: after_result.suggestion,
          // detail : after_result.detail
        })
      } else { //서버보다 노래가 먼저 끝남
        io.to(socket.id).emit('golive')
      }
    }
  })
  
})


function secto(seconds) {
  seconds = parseInt(seconds)
  var hour = parseInt(seconds/3600) < 10 ? '0' + parseInt(seconds/3600) : parseInt(seconds/3600);
  var min = parseInt((seconds%3600)/60) < 10 ? '0' + parseInt((seconds%3600)/60) : parseInt((seconds%3600)/60);
  var sec = seconds%60 < 10 ? '0' + seconds%60 : seconds%60;

  return hour == '00' ? min + ":" + sec : hour + ":" + min + ":" + sec

}

function timeto(timeString) {
  var a = timeString.match(/:/g).length
  var hours, minutes, seconds
  a < 2 ?  ([minutes, seconds] = timeString.split(':').map(Number), hours = 0) :  ([hours, minutes, seconds] = timeString.split(':').map(Number));
  return hours * 3600 + minutes * 60 + seconds;
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
		// 무작위로 index 값 생성 (0 이상 i 미만)
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}