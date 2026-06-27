const express = require('express');
const port = process.env.PORT || 8080;
const dotenv = require('dotenv');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const { createRemoteJWKSet, jwtVerify } = require('jose-cjs');

dotenv.config();
app.use(cors());
app.use(express.json());




const uri = process.env.MONGODB_URI;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const JWKS = createRemoteJWKSet(
      new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
      { timeoutDuration: 10000 }
    );

const verifyToken = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

   const token = authHeader.split(" ")[1]

   

    if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  try {
   
    const { payload } = await jwtVerify(token, JWKS);
    req.user = payload

    next();
  } catch (error) {
    console.error('Token validation failed:', error);
    return res.status(401).json({ message: 'Unauthorized' });
  }
};

const ownerVerify = async (req, res, next) => {
  const user = req.user;
  if(user.role !=="owner"){
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next()
}

const tenantVerify = async (req, res, next) => {
  const user = req.user;
  if(user.role !=="tenant"){
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next()
}

const adminVerify = async (req, res, next) => {
  const user = req.user;
  if(user.role !=="admin"){
    return res.status(401).json({ message: 'Unauthorized' });
  }
  next()
}

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    
    const db = client.db("rentnestdb");
    const propertyCollection =db.collection("properties")
    const bookingCollection =db.collection("bookings")
    const reviewCollection = db.collection("reviews");

    app.post("/owner/properties", verifyToken, ownerVerify, async(req, res) =>{
      const data = req.body
      const result = await propertyCollection.insertOne({...data, userId: req.user.id})

      res.send(result);
    });

    app.post("/properties/:propertyId/reviews", verifyToken, tenantVerify, async (req, res) => {
    const { propertyId } = req.params;
    const { rating, comment } = req.body;

    const review = {
        propertyId,
        rating: Number(rating),
        comment,
        tenantId: req.user.id,
        tenantName: req.user.name || "Anonymous",
        tenantEmail: req.user.email || null,
        tenantPhoto: req.user.image || req.user.picture || null,
        createdAt: new Date()
    };

    const result = await reviewCollection.insertOne(review);
    res.send(result);
});

app.get("/properties/:propertyId/reviews", async (req, res) => {
    const { propertyId } = req.params;
    const result = await reviewCollection.find({ propertyId }).toArray();
    res.send(result);
});

app.get("/reviews/featured", async (req, res) => {
    const result = await reviewCollection.find().limit(4).toArray();
    res.send(result);
});

    app.get("/owner/properties", verifyToken, ownerVerify, async(req, res) =>{
      const result = await propertyCollection.find({userId: req.user.id}).toArray();
      res.send(result)
    })

    app.get("/admin/properties", verifyToken, adminVerify, async(req, res) =>{
      const result = await propertyCollection.find().toArray();
      res.send(result)
    })

    app.get("/properties", async (req, res) => {
    const { status } = req.query;
    const filter = status ? { status } : {};
    const result = await propertyCollection.find(filter).toArray();
    res.send(result);
});

app.get("/featured", async (req, res) => {
  const cursor = propertyCollection.find().limit(6);
  const result = await cursor.toArray();
  res.send(result);
});

app.get("/properties/:propertyId", verifyToken, async (req, res) => {
  const { propertyId } = req.params;
  const query = { _id: new ObjectId(propertyId) };
  const result = await propertyCollection.findOne(query);
  res.send(result);
});

    app.patch("/owner/properties/:propertyId", verifyToken, ownerVerify, async (req,res)=>{
  const {propertyId} = req.params;
  const updatedData =req.body;
  const filter = { _id: new ObjectId(propertyId), userId: req.user.id };
  const updatedDoc ={
    $set :{
      ...updatedData,
    },
  };
  const result = await propertyCollection.updateOne(filter, updatedDoc);

  res.send(result);
})

    app.patch("/admin/properties/:propertyId", verifyToken, adminVerify, async (req,res)=>{
  const {propertyId} = req.params;
  const updatedData =req.body;
  const filter = { _id: new ObjectId(propertyId) };
  const updatedDoc ={
    $set :{
      ...updatedData,
    },
  };
  const result = await propertyCollection.updateOne(filter, updatedDoc);

  res.send(result);
})


app.delete("/owner/properties/:propertyId", verifyToken, ownerVerify, async (req,res)=>{
  const propertyId = req.params.propertyId;
  const query = { _id: new ObjectId(propertyId),userId: req.user.id
  };
  const result = await propertyCollection.deleteOne(query);
 
  res.send(result);
})

app.delete("/admin/properties/:propertyId", verifyToken, adminVerify, async (req,res)=>{
  const propertyId = req.params.propertyId;
  const query = { _id: new ObjectId(propertyId),
  };
  const result = await propertyCollection.deleteOne(query);
 
  res.send(result);
})

    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);


app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});