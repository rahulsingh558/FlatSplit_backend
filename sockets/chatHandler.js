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
    socket.on('join-dm', ({ flatId, memberId }) => {
      // Room name combining both IDs consistently would be better, 
      // but for now we'll just join a room specific to the pair.
      // E.g., dm-flatId-user1-user2
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
    });
  });
};
