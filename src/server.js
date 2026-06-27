const express = require('express')
require("dotenv").config();
const app = require('./app')



const PORT = process.env.PORT || 5000

// listen for server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`)
})
