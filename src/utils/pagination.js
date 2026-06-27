exports.getPagination = (req) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.max(Number(req.query.limit) || 10, 1);

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

exports.getPaginationMeta = (page, limit, totalRecords) => {
  const totalPages = Math.ceil(totalRecords / limit);

  return {
    currentPage: page,
    perPage: limit,
    totalRecords,
    totalPages,

    hasPreviousPage: page > 1,
    hasNextPage: page < totalPages,

    prevPage: page > 1 ? page - 1 : null,
    nextPage: page < totalPages ? page + 1 : null,
  };
};