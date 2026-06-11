import heapq
from graph.campus_graph import CampusGraph

class RouteEngine:
    def __init__(self, graph):
        self.graph = graph  # CampusGraph object

    def find_safest_route(self, start_id, end_id):
        # Dijkstra's algorithm — finds lowest weight path
        # lower weight = safer path

        # priority queue — (cost, node_id, path)
        queue = [(0, start_id, [start_id])]

        # visited nodes
        visited = set()

        # best cost to reach each node
        best_cost = {node_id: float('inf') for node_id in self.graph.nodes}
        best_cost[start_id] = 0

        while queue:
            cost, current_id, path = heapq.heappop(queue)

            # skip if already visited
            if current_id in visited:
                continue

            visited.add(current_id)

            # reached destination
            if current_id == end_id:
                return {
                    "path": path,
                    "total_cost": cost,
                    "nodes": [self.graph.get_node(n_id) for n_id in path]
                }

            # explore neighbors
            for edge in self.graph.get_neighbors(current_id):
                neighbor_id = edge.end_node.node_id

                if neighbor_id in visited:
                    continue

                # calculate new cost
                new_cost = cost + edge.safety_weight()

                # apply safety bonus from node
                neighbor_node = self.graph.get_node(neighbor_id)
                new_cost -= neighbor_node.safety_bonus()

                # make sure cost never goes negative
                new_cost = max(0, new_cost)

                if new_cost < best_cost[neighbor_id]:
                    best_cost[neighbor_id] = new_cost
                    heapq.heappush(queue, (new_cost, neighbor_id, path + [neighbor_id]))

        # no path found
        return None

    def find_fastest_route(self, start_id, end_id):
        # same as Dijkstra but uses distance only — ignores safety weights
        queue = [(0, start_id, [start_id])]
        visited = set()
        best_cost = {node_id: float('inf') for node_id in self.graph.nodes}
        best_cost[start_id] = 0

        while queue:
            cost, current_id, path = heapq.heappop(queue)

            if current_id in visited:
                continue

            visited.add(current_id)

            if current_id == end_id:
                return {
                    "path": path,
                    "total_cost": cost,
                    "nodes": [self.graph.get_node(n_id) for n_id in path]
                }

            for edge in self.graph.get_neighbors(current_id):
                neighbor_id = edge.end_node.node_id

                if neighbor_id in visited:
                    continue

                new_cost = cost + edge.distance

                if new_cost < best_cost[neighbor_id]:
                    best_cost[neighbor_id] = new_cost
                    heapq.heappush(queue, (new_cost, neighbor_id, path + [neighbor_id]))

        return None