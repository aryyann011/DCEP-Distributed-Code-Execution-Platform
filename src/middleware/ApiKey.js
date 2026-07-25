export const requireApiKey = (req, res, next) => {
    const clientKey = req.headers['x-api-key'];

    const serverKey = process.env.ENGINE_API_KEY;

    if(!serverKey){
        console.error("CRITICAL: ENGINE_API_KEY is not defined in .env file");
        return res.status(500).json({sucess : false, error : "Internal Server Configuration Error"});
    }

    if(!clientKey || clientKey !== serverKey){
        return res.status(401).json({success : false, error : "Unauthorised : Invalid or missing "})
    }

    next();
}