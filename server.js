import express from 'express'
import codeRun from './routes/submission.route.js'
const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.use('/api/submission', codeRun);

app.listen(PORT, () => {
    console.log(`sever running at port ${PORT}`)
})