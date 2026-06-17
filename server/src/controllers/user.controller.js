import { User } from '../models/User.model.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import bcrypt from 'bcryptjs';
import { UserRole } from '@dropzone/shared-domain';

export const getUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: UserRole.SUPER_ADMIN } })
      .select('-passwordHash -refreshTokenHash')
      .populate('assignedWarehouse', 'name code')
      .sort({ createdAt: -1 });
    return sendSuccess(res, 200, users);
  } catch (error) {
    console.error('Error fetching users:', error);
    return sendError(res, 500, 'Failed to fetch team members');
  }
};

export const createUser = async (req, res) => {
  try {
    const { email, password, name, phone, role, assignedWarehouse } = req.body;

    if (!email || !password || !name || !phone || !role) {
      return sendError(res, 400, 'All fields are required.');
    }
    
    if (role === UserRole.DRIVER && !assignedWarehouse) {
      return sendError(res, 400, 'Driver must be assigned to a warehouse.');
    }

    // Only allow creating ADMIN or DRIVER (prevent creating SUPER_ADMIN via this API)
    if (![UserRole.ADMIN, UserRole.DRIVER].includes(role)) {
      return sendError(res, 400, 'Invalid role provided.');
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return sendError(res, 409, 'User with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = new User({
      email,
      passwordHash,
      name,
      phone,
      role,
      assignedWarehouse: role === UserRole.DRIVER ? assignedWarehouse : undefined
    });

    await user.save();
    
    // Convert to object and strip sensitive info
    const userResponse = user.toObject();
    delete userResponse.passwordHash;
    delete userResponse.refreshTokenHash;

    return sendSuccess(res, 201, userResponse, 'Team member created successfully.');
  } catch (error) {
    console.error('Error creating user:', error.message);
    return sendError(res, 500, 'Failed to create team member: ' + error.message);
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    // Protect super admin from being deleted
    if (user.role === UserRole.SUPER_ADMIN) {
      return sendError(res, 403, 'Cannot delete a SUPER_ADMIN account.');
    }

    if (user.role === UserRole.DRIVER) {
      const { Crisis } = await import('../models/Crisis.model.js');
      const activeMission = await Crisis.findOne({ assignedDriverId: id });
      if (activeMission) {
        return sendError(res, 400, 'Cannot delete driver with an active mission.');
      }
    }

    await User.findByIdAndDelete(id);
    return sendSuccess(res, 200, { deletedId: id }, 'User deleted successfully.');
  } catch (error) {
    console.error('Error deleting user:', error);
    return sendError(res, 500, 'Failed to delete team member');
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, assignedWarehouse } = req.body;

    const user = await User.findById(id);
    if (!user) {
      return sendError(res, 404, 'User not found.');
    }

    if (user.role === UserRole.SUPER_ADMIN) {
      return sendError(res, 403, 'Cannot modify SUPER_ADMIN account via this endpoint.');
    }

    if (name) user.name = name;
    if (phone) user.phone = phone;
    
    if (user.role === UserRole.DRIVER && assignedWarehouse) {
      user.assignedWarehouse = assignedWarehouse;
    }

    await user.save();

    const userResponse = await User.findById(id).populate('assignedWarehouse', 'name code').select('-passwordHash -refreshTokenHash');
    
    // Notify the driver that their warehouse assignment changed
    if (user.role === UserRole.DRIVER) {
      const { getIO } = await import('../sockets/socketManager.js');
      const io = getIO();
      if (io) {
        io.to(`driver:${user._id}`).emit('driver:warehouse_updated', userResponse.assignedWarehouse);
      }
    }
    
    return sendSuccess(res, 200, userResponse, 'User updated successfully.');
  } catch (error) {
    console.error('Error updating user:', error.message);
    return sendError(res, 500, 'Failed to update team member: ' + error.message);
  }
};
