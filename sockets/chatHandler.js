module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);

    // Group Events
    socket.on('join-flat', ({ flatId }) => {
      socket.join(`flat-${flatId}`);
      console.log(`User joined flat: ${flatId}`);
    });

    socket.on('new-message', (data) => {
      io.to(`flat-${data.flatId}`).emit('message-received', data);
    });

    socket.on('typing', ({ userId, flatId }) => {
      socket.to(`flat-${flatId}`).emit('typing', { userId, flatId });
    });

    socket.on('stop-typing', ({ userId, flatId }) => {
      socket.to(`flat-${flatId}`).emit('stop-typing', { userId, flatId });
    });
    // Personal / DM Events
    socket.on('join-dm', ({ flatId, userId1, userId2 }) => {
      // Room name combining both IDs consistently
      const ids = [userId1, userId2].sort();
      const roomName = `dm-${flatId}-${ids[0]}-${ids[1]}`;
      socket.join(roomName);
      console.log(`User joined DM room: ${roomName}`);
    });

    socket.on('new-direct-message', (data) => {
      const ids = [data.sender._id || data.sender, data.receiverId].sort();
      const roomName = `dm-${data.flatId}-${ids[0]}-${ids[1]}`;
      io.to(roomName).emit('direct-message-received', data);
    });

    socket.on('dm-typing', ({ flatId, senderId, receiverId }) => {
      const ids = [senderId, receiverId].sort();
      const roomName = `dm-${flatId}-${ids[0]}-${ids[1]}`;
      socket.to(roomName).emit('dm-typing', { senderId });
    });

    socket.on('dm-stop-typing', ({ flatId, senderId, receiverId }) => {
      const ids = [senderId, receiverId].sort();
      const roomName = `dm-${flatId}-${ids[0]}-${ids[1]}`;
      socket.to(roomName).emit('dm-stop-typing', { senderId });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};
