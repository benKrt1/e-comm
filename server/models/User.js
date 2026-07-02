import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// Cart and wishlist are embedded (not separate collections) because both are
// strictly 1:1 with a user, always loaded together with the user, and never
// queried on their own — embedding saves a join on every page load.
const cartItemSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true, min: [1, 'Quantity must be at least 1'], default: 1 },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false, // never included in queries unless explicitly requested
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
    cart: [cartItemSchema],
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

// Hash the password only when it has actually changed (registration / password update),
// not on every save of an unrelated field like the cart.
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// Compare a plaintext login attempt against the stored hash.
// Requires the query to have opted in: User.findOne(...).select('+password')
userSchema.methods.matchPassword = function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

export default User;
