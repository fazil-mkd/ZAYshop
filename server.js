const express= require('express')
const app= express();
require('dotenv').config()
const db = require("./config/db")
const PORT = process.env.PORT || 4000;
db()


app.set('view engine', 'ejs');
app.set('views', './views');

app.use(express.static('public'));


app.get('/contact',(req,res)=>{
res.render('contact')
})

app.get('/',(req,res)=>{
    res.render('index')
    })
    

    app.get('/about',(req,res)=>{
        res.render('about')
        })
        
        app.get('/shop',(req,res)=>{
            res.render('shop')
            })



            app.listen(PORT,() => {
              console.log(`Server running on port ${PORT}`);
            });
            